import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Item, ItemStatus } from "../data";
import { commitFiles, GhError } from "../github";
import Md from "../Md";
import { ERR, usePy } from "../PyRunner";
import { C, F } from "../theme";
import { Btn, Chip, T } from "../ui";
import { buildWorkspace, clearDrafts, isTest, isText, saveDraft, Workspace } from "../workspace";

type Props = {
  item: Item;
  status?: ItemStatus;
  token: string | null;
  onClose: () => void;
  onSubmitted: () => void;
  onNeedToken: () => void;
};

type Out = { kind: "run" | "test" | "submit" | "error"; code: number; text: string };
type Sel = { start: number; end: number };

const SYMBOLS: [string, string, number][] = [
  // [العنوان، النص المُدرج، كم حرفاً يرجع المؤشر]
  ["⇥", "    ", 0], ["( )", "()", 1], [":", ":", 0], ['" "', '""', 1], ["[ ]", "[]", 1], ["=", " = ", 0],
  ["{ }", "{}", 1], ["_", "_", 0], ["#", "# ", 0], [".", ".", 0], [",", ", ", 0], ["' '", "''", 1],
  ["+", " + ", 0], ["-", " - ", 0], ["*", " * ", 0], ["/", " / ", 0], ["==", " == ", 0], ["<", " < ", 0], [">", " > ", 0],
  ["print", "print()", 1], ["def", "def ():", 3], ["return", "return ", 0], ["if", "if :", 1], ["for", "for  in :", 5],
  ["f\"\"", 'f""', 1], ["{x}", "{}", 1],
];

const rel = (ws: Workspace, p: string) => (p.startsWith(ws.base + "/") ? p.slice(ws.base.length + 1) : p);

export default function Editor({ item, status, token, onClose, onSubmitted, onNeedToken }: Props) {
  const py = usePy();
  const [ws, setWs] = useState<Workspace | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [tab, setTab] = useState<"task" | "code" | "out">("task");
  const [current, setCurrent] = useState<string>("");
  const [forcedSel, setForcedSel] = useState<Sel | undefined>(undefined);
  const [caretLine, setCaretLine] = useState(1);
  const [busy, setBusy] = useState<Out["kind"] | null>(null);
  const [out, setOut] = useState<Out | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const sel = useRef<Sel>({ start: 0, end: 0 });
  const input = useRef<any>(null);
  const history = useRef<Record<string, string[]>>({});
  const draftTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const load = useCallback(async () => {
    setLoadErr(null);
    setWs(null);
    try {
      const w = await buildWorkspace(item, token);
      setWs(w);
      setCurrent(w.defaultFile);
      if (w.files.some((f) => f.path.endsWith(".py"))) py.warm();
      if (!w.readme || item.check.type !== "tests") setTab("code");
    } catch (e: any) {
      setLoadErr(e?.message || "تعذّر فتح التمرين");
    }
  }, [item, token, py]);

  useEffect(() => { load(); }, [load]);

  const file = ws?.files.find((f) => f.path === current);
  const code = !!file && !isText(file.path);
  const dirty = useMemo(() => (ws?.files ?? []).filter((f) => f.editable && f.content !== f.original), [ws]);

  const update = useCallback((path: string, content: string, pushHistory = true) => {
    setWs((w) => {
      if (!w) return w;
      const f = w.files.find((x) => x.path === path);
      if (f && pushHistory && f.content !== content) {
        const h = (history.current[path] ||= []);
        h.push(f.content);
        if (h.length > 200) h.shift();
      }
      return { ...w, files: w.files.map((x) => (x.path === path ? { ...x, content } : x)) };
    });
    clearTimeout(draftTimers.current[path]);
    draftTimers.current[path] = setTimeout(() => saveDraft(path, content), 600);
  }, []);

  const onChange = (text: string) => {
    if (!file) return;
    const old = file.content;
    const caret = sel.current.start;
    // مسافة بادئة تلقائية بعد Enter، وتزيد 4 مسافات بعد سطر ينتهي بـ :
    if (code && text.length === old.length + 1 && text[caret] === "\n" && text.slice(0, caret) === old.slice(0, caret)) {
      const line = old.slice(old.lastIndexOf("\n", caret - 1) + 1, caret);
      let indent = (line.match(/^ */) || [""])[0];
      if (line.trimEnd().endsWith(":")) indent += "    ";
      if (indent) {
        text = text.slice(0, caret + 1) + indent + text.slice(caret + 1);
        const pos = caret + 1 + indent.length;
        setForcedSel({ start: pos, end: pos });
        sel.current = { start: pos, end: pos };
      }
    }
    update(file.path, text);
  };

  const insert = (s: string, back: number) => {
    if (!file || !file.editable) return;
    const { start, end } = sel.current;
    const t = file.content.slice(0, start) + s + file.content.slice(end);
    const pos = start + s.length - back;
    update(file.path, t);
    sel.current = { start: pos, end: pos };
    setForcedSel({ start: pos, end: pos });
    input.current?.focus();
  };

  const undo = () => {
    if (!file) return;
    const h = history.current[file.path];
    const prev = h?.pop();
    if (prev !== undefined) update(file.path, prev, false);
  };

  const jobFiles = () => {
    const files: Record<string, string> = { ...(ws?.support ?? {}) };
    ws?.files.forEach((f) => { files[f.path] = f.content; });
    return files;
  };

  const run = async () => {
    if (!ws) return;
    const entry = file && file.path.endsWith(".py") && !isTest(file.path)
      ? file.path : ws.files.find((f) => f.path.endsWith(".py") && !isTest(f.path))?.path;
    if (!entry) return;
    setBusy("run"); setTab("out");
    const r = await py.run({ mode: "run", files: jobFiles(), base: ws.base, entry });
    setOut({ kind: "run", code: r.code, text: r.out || "(لم يطبع البرنامج شيئاً)\n" });
    setBusy(null);
  };

  const test = async () => {
    if (!ws) return;
    setBusy("test"); setTab("out");
    const r = await py.run({ mode: "test", files: jobFiles(), base: ws.base });
    setOut({ kind: "test", code: r.code, text: r.out });
    Haptics.notificationAsync(r.code === 0 ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error).catch(() => {});
    setBusy(null);
  };

  const submit = async () => {
    if (!ws) return;
    if (!token) { onNeedToken(); return; }
    const changed = ws.files.filter((f) => f.editable && f.content !== f.original && f.content.trim());
    if (!changed.length) {
      setTab("out");
      setOut({ kind: "submit", code: 1, text: "لا توجد تغييرات جديدة لإرسالها.\n" });
      return;
    }
    setBusy("submit"); setTab("out");
    try {
      await commitFiles(token, changed.map((f) => ({ path: f.path, content: f.content })), `${ws.commitVerb}: ${item.title}`);
      await clearDrafts(changed.map((f) => f.path));
      setWs((w) => w && { ...w, files: w.files.map((f) => (changed.some((c) => c.path === f.path) ? { ...f, original: f.content } : f)) });
      setOut({
        kind: "submit", code: 0,
        text: `تم رفع ${changed.length === 1 ? "ملف واحد" : `${changed.length} ملفات`} إلى GitHub.\nGitHub يصحّح الآن، وستصلك النقاط خلال دقيقة تقريباً.\n`,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onSubmitted();
    } catch (e: any) {
      setOut({ kind: "error", code: 1, text: ERR + (e instanceof GhError ? e.message : "تعذّر الرفع") + "\nمسودتك محفوظة على الجوال، لن تضيع.\n" });
      if (e instanceof GhError && e.status === 401) onNeedToken();
    } finally {
      setBusy(null);
    }
  };

  const addFile = () => {
    if (!ws || adding === null) return;
    const name = adding.trim().replace(/^\/+/, "");
    if (!/^[\w\-./]+\.(py|md|txt|json|csv)$/.test(name) || name.includes("..")) {
      setOut({ kind: "error", code: 1, text: ERR + "اسم غير صالح. مثال: utils/money.py\n" });
      setTab("out");
      return;
    }
    const path = `${ws.base}/${name}`;
    if (!ws.files.some((f) => f.path === path)) {
      setWs({ ...ws, files: [...ws.files, { path, content: "", original: null, editable: true }] });
    }
    setCurrent(path);
    setAdding(null);
  };

  const summary = (() => {
    if (busy === "run" || busy === "test") {
      return py.status === "loading" ? "جارٍ تحميل Python على جوالك (أول مرة فقط، قرابة 10 ميغابايت)…" : busy === "test" ? "تشغيل الاختبارات…" : "تشغيل…";
    }
    if (busy === "submit") return "الرفع إلى GitHub…";
    if (!out) return null;
    if (out.kind === "test") {
      const last = out.text.trim().split("\n").filter((l) => !l.startsWith(ERR)).pop() ?? "";
      return out.code === 0 ? `نجحت كل الاختبارات · ${last}` : out.code === 1 ? `بعض الاختبارات فشلت · ${last}` : "تعذّر تشغيل الاختبارات";
    }
    if (out.kind === "run") return out.code === 0 ? "انتهى التشغيل" : "توقّف البرنامج بخطأ";
    return out.code === 0 ? "تم الإرسال" : "لم يتم الإرسال";
  })();
  const good = out && out.code === 0 && !busy;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <SafeAreaView style={st.root} edges={["top", "bottom", "left", "right"]}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <View style={st.header}>
            <Pressable onPress={onClose} hitSlop={10} style={st.iconBtn}>
              <Ionicons name="arrow-forward" size={22} color={C.ink} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <T font="semi" size={15} numberOfLines={1} style={{ lineHeight: 22 }}>{item.title}</T>
              <T size={11} color={dirty.length ? C.gold : C.mut} style={{ lineHeight: 16 }}>
                {dirty.length ? "تغييرات غير مرسلة (محفوظة على الجوال)" : status?.done ? "مكتمل على GitHub" : "لا تغييرات"}
              </T>
            </View>
          </View>

          <View style={st.seg}>
            {([["task", "المهمة"], ["code", "الكود"], ["out", "النتيجة"]] as const).map(([k, label]) => (
              <Pressable key={k} onPress={() => setTab(k)} style={[st.segBtn, tab === k && st.segOn]}>
                <T size={13} font="bold" color={tab === k ? "#fff" : C.mut} style={{ lineHeight: 18 }}>{label}</T>
                {k === "out" && out && !busy ? <View style={[st.dot, { backgroundColor: good ? C.ok : C.danger }]} /> : null}
              </Pressable>
            ))}
          </View>

          {!ws ? (
            <View style={st.center}>
              {loadErr ? (
                <>
                  <T color={C.danger} style={{ textAlign: "center" }}>{loadErr}</T>
                  <Btn kind="ghost" label="أعد المحاولة" icon="refresh" style={{ marginTop: 14 }} onPress={load} />
                </>
              ) : <ActivityIndicator color={C.acc} size="large" />}
            </View>
          ) : tab === "task" ? (
            <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 30 }}>
              {status?.detail && !status.done && item.check.type !== "manual" ? (
                <View style={{ marginBottom: 8 }}><Chip label={`على GitHub: ${status.detail}`} color={C.gold} /></View>
              ) : null}
              <Md source={ws.readme} />
              <Btn label="ابدأ الكتابة" icon="code-slash" style={{ marginTop: 20 }} onPress={() => setTab("code")} />
              {!token ? (
                <T size={12} color={C.mut} style={{ marginTop: 12 }}>للإرسال من الجوال تحتاج ربط GitHub مرة واحدة من تبويب الأدوات.</T>
              ) : null}
            </ScrollView>
          ) : tab === "code" ? (
            <View style={{ flex: 1 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={st.files}>
                {ws.files.map((f) => {
                  const on = f.path === current;
                  const changed = f.editable && f.content !== f.original;
                  return (
                    <Pressable key={f.path} onPress={() => setCurrent(f.path)} style={[st.fileTab, on && st.fileOn]}>
                      {!f.editable ? <Ionicons name="lock-closed" size={11} color={C.mut} /> : null}
                      <Text style={[st.fileName, on && { color: C.ink }]}>{rel(ws, f.path)}</Text>
                      {changed ? <View style={[st.dot, { backgroundColor: C.gold }]} /> : null}
                    </Pressable>
                  );
                })}
                {item.check.type !== "file" ? (
                  <Pressable onPress={() => setAdding(adding === null ? "" : null)} style={st.fileTab} hitSlop={6}>
                    <Ionicons name="add" size={16} color={C.acc} />
                  </Pressable>
                ) : null}
              </ScrollView>
              {adding !== null ? (
                <View style={st.addRow}>
                  <TextInput value={adding} onChangeText={setAdding} placeholder="utils/money.py" placeholderTextColor={C.mut}
                    autoFocus autoCapitalize="none" autoCorrect={false} onSubmitEditing={addFile} style={st.addInput} />
                  <Btn label="إضافة" onPress={addFile} style={{ minHeight: 40 }} />
                </View>
              ) : null}

              {file ? (
                <View style={[{ flex: 1 }, code && { direction: "ltr" }]}>
                  <TextInput
                    ref={input}
                    value={file.content}
                    onChangeText={onChange}
                    editable={file.editable}
                    selection={forcedSel}
                    onSelectionChange={(e) => {
                      sel.current = e.nativeEvent.selection;
                      if (forcedSel) setForcedSel(undefined);
                      setCaretLine(file.content.slice(0, e.nativeEvent.selection.start).split("\n").length);
                    }}
                    multiline
                    scrollEnabled
                    autoCapitalize="none"
                    autoCorrect={false}
                    spellCheck={false}
                    autoComplete="off"
                    importantForAutofill="no"
                    textAlignVertical="top"
                    placeholder={code ? "# اكتب الكود هنا" : "اكتب هنا…"}
                    placeholderTextColor={C.mut}
                    style={[st.editor, code ? st.editorCode : st.editorText, !file.editable && { color: C.mut }]}
                  />
                </View>
              ) : null}

              {code && file?.editable ? (
                <View style={{ direction: "ltr" }}>
                  <ScrollView horizontal keyboardShouldPersistTaps="always" showsHorizontalScrollIndicator={false} contentContainerStyle={st.symbols}>
                    <Pressable onPress={undo} style={st.sym}><Ionicons name="arrow-undo" size={16} color={C.ink} /></Pressable>
                    {SYMBOLS.map(([label, s, back]) => (
                      <Pressable key={label} onPress={() => insert(s, back)} style={st.sym}>
                        <Text style={st.symText}>{label}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              ) : null}
              {code ? <Text style={st.caret}>سطر {caretLine}</Text> : null}
            </View>
          ) : (
            <View style={{ flex: 1 }}>
              {summary ? (
                <View style={[st.banner, busy ? null : { backgroundColor: good ? "rgba(61,220,151,0.14)" : "rgba(255,107,107,0.14)" }]}>
                  {busy ? <ActivityIndicator color={C.acc} /> : <Ionicons name={good ? "checkmark-circle" : "alert-circle"} size={22} color={good ? C.ok : C.danger} />}
                  <T font="bold" size={14} style={{ flex: 1, lineHeight: 22 }}>{summary}</T>
                </View>
              ) : (
                <T color={C.mut} style={{ padding: 18 }}>شغّل الكود أو الاختبارات لترى النتيجة هنا.</T>
              )}
              {out && !busy ? (
                <ScrollView style={{ direction: out.kind === "submit" ? "rtl" : "ltr" }} contentContainerStyle={{ padding: 16 }}>
                  {out.text.split("\n").map((l, i) => {
                    const isErr = l.startsWith(ERR);
                    const text = isErr ? l.slice(1) : l;
                    return out.kind === "submit" || out.kind === "error" ? (
                      <T key={i} color={isErr ? C.danger : C.ink}>{text}</T>
                    ) : (
                      <Text key={i} selectable style={[st.outLine, isErr && { color: C.danger }]}>{text || " "}</Text>
                    );
                  })}
                  {out.kind === "test" && out.code !== 0 ? (
                    <T size={13} color={C.mut} style={{ marginTop: 14, writingDirection: "rtl" }}>
                      اقرأ رسالة الخطأ الأولى بتمعّن. إذا علقت، انسخها واستعمل برومبت «تلميح».
                    </T>
                  ) : null}
                </ScrollView>
              ) : null}
            </View>
          )}

          {ws && tab !== "task" ? (
            <View style={st.actions}>
              {ws.files.some((f) => f.path.endsWith(".py") && !isTest(f.path)) ? (
                <ActionBtn icon="play" label="تشغيل" onPress={run} disabled={!!busy} />
              ) : null}
              {ws.hasTests ? <ActionBtn icon="flask" label="اختبار" onPress={test} disabled={!!busy} /> : null}
              <ActionBtn icon="cloud-upload" label="إرسال" onPress={submit} disabled={!!busy} primary />
            </View>
          ) : null}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function ActionBtn({ icon, label, onPress, disabled, primary }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; disabled?: boolean; primary?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled}
      style={({ pressed }) => [st.action, primary && { backgroundColor: C.cobalt, borderColor: C.cobalt }, (pressed || disabled) && { opacity: 0.6 }]}>
      <Ionicons name={icon} size={18} color={primary ? "#fff" : C.ink} />
      <T font="bold" size={14} color={primary ? "#fff" : C.ink} style={{ lineHeight: 20 }}>{label}</T>
    </Pressable>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.line },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  seg: { flexDirection: "row", backgroundColor: C.surface, borderRadius: 12, padding: 4, margin: 12, marginBottom: 6, gap: 4 },
  segBtn: { flex: 1, minHeight: 38, borderRadius: 9, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 },
  segOn: { backgroundColor: C.cobalt },
  dot: { width: 7, height: 7, borderRadius: 4 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  files: { paddingHorizontal: 12, gap: 6, paddingVertical: 6 },
  fileTab: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, minHeight: 34, borderRadius: 9, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line },
  fileOn: { borderColor: C.acc, backgroundColor: C.surface2 },
  fileName: { fontFamily: "monospace", fontSize: 12, color: C.mut },
  addRow: { flexDirection: "row", gap: 8, paddingHorizontal: 12, paddingBottom: 6, alignItems: "center" },
  addInput: { flex: 1, minHeight: 40, borderRadius: 10, backgroundColor: C.surface, color: C.ink, paddingHorizontal: 12, fontFamily: "monospace", fontSize: 14, borderWidth: 1, borderColor: C.line },
  editor: { flex: 1, marginHorizontal: 12, marginTop: 4, padding: 12, borderRadius: 12, backgroundColor: "#070A13", borderWidth: 1, borderColor: C.line, color: C.ink },
  editorCode: { fontFamily: "monospace", fontSize: 14, lineHeight: 21, textAlign: "left", writingDirection: "ltr" },
  editorText: { fontFamily: F.body, fontSize: 16, lineHeight: 28, writingDirection: "rtl" },
  symbols: { gap: 6, paddingHorizontal: 12, paddingVertical: 8 },
  sym: { minWidth: 42, height: 40, paddingHorizontal: 10, borderRadius: 9, backgroundColor: C.surface2, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.line },
  symText: { fontFamily: "monospace", fontSize: 15, color: C.ink },
  caret: { fontSize: 11, color: C.mut, paddingHorizontal: 14, paddingBottom: 2, fontFamily: F.body },
  banner: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 12, marginTop: 6, padding: 12, borderRadius: 12, backgroundColor: C.surface },
  outLine: { fontFamily: "monospace", fontSize: 13, lineHeight: 20, color: C.ink, textAlign: "left", writingDirection: "ltr" },
  actions: { flexDirection: "row", gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.surface },
  action: { flex: 1, minHeight: 46, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: C.surface2, borderWidth: 1, borderColor: C.line },
});
