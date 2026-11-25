import React, { createContext, ReactNode, useCallback, useContext, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import { HARNESS } from "./harness";

// Python يعمل على الجوال نفسه عبر Pyodide داخل WebView مخفي.
// يُحمَّل من الإنترنت أول مرة (قرابة 10 ميغابايت) ثم يبقى في ذاكرة الـ WebView.
const PYODIDE_VERSION = "314.0.8";

export type Job = { mode: "run" | "test"; files: Record<string, string>; base: string; entry?: string };
export type RunResult = { code: number; out: string };
export type PyStatus = "idle" | "loading" | "ready" | "error";

type Ctx = { run: (job: Job) => Promise<RunResult>; warm: () => void; status: PyStatus };
const PyCtx = createContext<Ctx | null>(null);

export const ERR = "\u0001";
const LINE_SEP = new RegExp("\\u2028", "g");
const PARA_SEP = new RegExp("\\u2029", "g"); // بداية كل سطر من stderr

const HTML = `<!doctype html><html><head><meta charset="utf-8"></head><body><script>
const BASE = "https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/";
const HARNESS = ${JSON.stringify(HARNESS)};
const send = (o) => window.ReactNativeWebView.postMessage(JSON.stringify(o));
let boot = null;
function load(src) {
  return new Promise((ok, no) => {
    const s = document.createElement("script");
    s.src = src; s.onload = ok; s.onerror = () => no(new Error("network"));
    document.head.appendChild(s);
  });
}
function start() {
  if (!boot) {
    boot = (async () => {
      send({ type: "status", status: "loading" });
      await load(BASE + "pyodide.js");
      const p = await loadPyodide({ indexURL: BASE });
      await p.loadPackage(["pytest"]);
      p.setStdin({ error: true });
      await p.runPythonAsync(HARNESS);
      send({ type: "status", status: "ready" });
      return p;
    })().catch((e) => { boot = null; send({ type: "status", status: "error", error: String(e && e.message || e) }); throw e; });
  }
  return boot;
}
window.warm = () => { start().catch(() => {}); };
window.handle = async (job) => {
  let p;
  try { p = await start(); }
  catch (e) { send({ type: "result", id: job.id, code: -1, out: "\\u0001تعذّر تحميل Python. تحقق من الإنترنت ثم أعد المحاولة.\\n" }); return; }
  send({ type: "started", id: job.id });
  const out = [];
  p.setStdout({ batched: (s) => out.push(s + "\\n") });
  p.setStderr({ batched: (s) => out.push(s.split("\\n").map((l) => "\\u0001" + l).join("\\n") + "\\n") });
  try {
    p.globals.set("FILES", p.toPy(job.files));
    const code = await p.runPythonAsync("run_job(FILES, " + JSON.stringify(job.base) + ", " + JSON.stringify(job.entry || "") + ", " + JSON.stringify(job.mode) + ")");
    send({ type: "result", id: job.id, code: Number(code), out: out.join("") });
  } catch (e) {
    out.push("\\u0001" + String(e && e.message || e) + "\\n");
    send({ type: "result", id: job.id, code: -1, out: out.join("") });
  }
};
</script></body></html>`;

// أنواع react-native-webview لا تتوافق بعد مع أنواع React 19.3 في هذا الإصدار، والمكوّن نفسه يعمل.
const WV = WebView as unknown as React.ComponentType<any>;

type Pending = { resolve: (r: RunResult) => void; timer?: ReturnType<typeof setTimeout>; mode: Job["mode"]; started: boolean };

export function PyProvider({ children }: { children: ReactNode }) {
  const web = useRef<any>(null);
  const [mounted, setMounted] = useState(false);
  const [key, setKey] = useState(0);
  const [status, setStatus] = useState<PyStatus>("idle");
  const pageLoaded = useRef(false);
  const queue = useRef<string[]>([]);
  const pending = useRef(new Map<number, Pending>());
  const nextId = useRef(1);

  const inject = useCallback((js: string) => {
    if (pageLoaded.current && web.current) web.current.injectJavaScript(js + ";true;");
    else queue.current.push(js);
  }, []);

  const reset = useCallback((message: string) => {
    pending.current.forEach((p) => { clearTimeout(p.timer); p.resolve({ code: -2, out: ERR + message + "\n" }); });
    pending.current.clear();
    pageLoaded.current = false;
    queue.current = [];
    setStatus("idle");
    setKey((k) => k + 1);
  }, []);

  const warm = useCallback(() => {
    setMounted(true);
    inject("window.warm()");
  }, [inject]);

  const run = useCallback((job: Job) => {
    setMounted(true);
    const id = nextId.current++;
    return new Promise<RunResult>((resolve) => {
      pending.current.set(id, { resolve, mode: job.mode, started: false });
      const payload = JSON.stringify({ ...job, id }).replace(LINE_SEP, "\\u2028").replace(PARA_SEP, "\\u2029");
      inject(`window.handle(${payload})`);
    });
  }, [inject]);

  const onMessage = useCallback((e: WebViewMessageEvent) => {
    let msg: any;
    try { msg = JSON.parse(e.nativeEvent.data); } catch { return; }
    if (msg.type === "status") setStatus(msg.status);
    if (msg.type === "started") {
      const p = pending.current.get(msg.id);
      if (p) {
        p.started = true;
        // المهلة تبدأ بعد تحميل Python، حتى لا يُحسب وقت التحميل الأول
        p.timer = setTimeout(() => reset("توقّف التنفيذ بعد تجاوز الوقت المسموح. هل توجد حلقة لا تنتهي؟"), p.mode === "test" ? 60000 : 20000);
      }
    }
    if (msg.type === "result") {
      const p = pending.current.get(msg.id);
      if (p) {
        clearTimeout(p.timer);
        pending.current.delete(msg.id);
        p.resolve({ code: msg.code, out: msg.out || "" });
      }
    }
  }, [reset]);

  const value = useMemo(() => ({ run, warm, status }), [run, warm, status]);

  return (
    <PyCtx.Provider value={value}>
      {children}
      {mounted ? (
        <View style={{ position: "absolute", width: 1, height: 1, opacity: 0, left: -10, top: -10 }} pointerEvents="none">
          <WV
            key={key}
            ref={web}
            source={{ html: HTML, baseUrl: "https://localhost/" }}
            originWhitelist={["*"]}
            javaScriptEnabled
            onMessage={onMessage}
            onLoadEnd={() => {
              pageLoaded.current = true;
              const js = queue.current.splice(0);
              js.forEach((x) => web.current?.injectJavaScript(x + ";true;"));
            }}
            onContentProcessDidTerminate={() => reset("توقّف محرك Python، أعد المحاولة.")}
            onRenderProcessGone={() => reset("توقّف محرك Python، أعد المحاولة.")}
          />
        </View>
      ) : null}
    </PyCtx.Provider>
  );
}

export function usePy(): Ctx {
  const c = useContext(PyCtx);
  if (!c) throw new Error("PyProvider missing");
  return c;
}
