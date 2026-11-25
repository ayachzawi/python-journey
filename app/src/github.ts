import * as SecureStore from "expo-secure-store";
import { REPO } from "./data";

// مفتاح GitHub (fine-grained token) يُحفظ مشفّراً على الجوال فقط، ولا يُرسل إلا إلى api.github.com.
const TOKEN_KEY = "gh_token";
const API = `https://api.github.com/repos/${REPO}`;

export async function getToken(): Promise<string | null> {
  try { return await SecureStore.getItemAsync(TOKEN_KEY); } catch { return null; }
}
export async function setToken(t: string) { await SecureStore.setItemAsync(TOKEN_KEY, t.trim()); }
export async function clearToken() { await SecureStore.deleteItemAsync(TOKEN_KEY); }

function headers(token: string | null, extra: Record<string, string> = {}) {
  return {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

export class GhError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function call<T>(token: string | null, path: string, init: RequestInit = {}): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(path.startsWith("http") ? path : API + path, {
      ...init,
      headers: { ...headers(token), ...(init.headers as Record<string, string> | undefined) },
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const msg =
        res.status === 401 ? "المفتاح غير صالح أو انتهت صلاحيته. اربط GitHub من جديد." :
        res.status === 403 ? "GitHub رفض الطلب: تحقق أن للمفتاح صلاحية Contents: Read and write، أو انتظر قليلاً (حد الطلبات)." :
        res.status === 404 ? "لم أجد المطلوب على GitHub." :
        `خطأ من GitHub (${res.status})`;
      throw new GhError(res.status, msg);
    }
    return (await res.json()) as T;
  } catch (e: any) {
    if (e instanceof GhError) throw e;
    throw new GhError(0, e?.name === "AbortError" ? "انتهت المهلة، تحقق من الإنترنت." : "تعذّر الاتصال، تحقق من الإنترنت.");
  } finally {
    clearTimeout(timer);
  }
}

/** يتحقق أن المفتاح يستطيع الكتابة على المستودع، ويرجع اسم الحساب. */
export async function verifyToken(token: string): Promise<string> {
  const repo = await call<{ permissions?: { push?: boolean } }>(token, "");
  if (!repo.permissions?.push) throw new GhError(403, "المفتاح يقرأ المستودع لكنه لا يستطيع الكتابة. فعّل Contents: Read and write.");
  try {
    const me = await call<{ login: string }>(token, "https://api.github.com/user");
    return me.login;
  } catch {
    return "ayachzawi";
  }
}

export type TreeEntry = { path: string; type: "blob" | "tree"; sha: string; size?: number };

export async function listTree(token: string | null): Promise<TreeEntry[]> {
  const res = await call<{ tree: TreeEntry[] }>(token, "/git/trees/main?recursive=1");
  return res.tree.filter((t) => t.type === "blob");
}

/** محتوى ملف نصي من المستودع (UTF-8). */
export async function readFile(token: string | null, path: string): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(`${API}/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=main`, {
      headers: headers(token, { Accept: "application/vnd.github.raw+json" }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new GhError(res.status, `تعذّر قراءة ${path}`);
    return await res.text();
  } catch (e: any) {
    if (e instanceof GhError) throw e;
    throw new GhError(0, "تعذّر الاتصال، تحقق من الإنترنت.");
  } finally {
    clearTimeout(timer);
  }
}

/**
 * يرفع عدة ملفات في commit واحد على main.
 * إذا سبقه commit آخر (مثل تحديث التقدم من البوت) يعيد المحاولة على آخر نسخة.
 */
export async function commitFiles(token: string, files: { path: string; content: string }[], message: string): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const ref = await call<{ object: { sha: string } }>(token, "/git/ref/heads/main");
    const parent = await call<{ tree: { sha: string } }>(token, `/git/commits/${ref.object.sha}`);
    const tree = await call<{ sha: string }>(token, "/git/trees", {
      method: "POST",
      body: JSON.stringify({
        base_tree: parent.tree.sha,
        tree: files.map((f) => ({ path: f.path, mode: "100644", type: "blob", content: f.content })),
      }),
    });
    const commit = await call<{ sha: string }>(token, "/git/commits", {
      method: "POST",
      body: JSON.stringify({ message, tree: tree.sha, parents: [ref.object.sha] }),
    });
    try {
      await call(token, "/git/refs/heads/main", { method: "PATCH", body: JSON.stringify({ sha: commit.sha, force: false }) });
      return commit.sha;
    } catch (e) {
      if (e instanceof GhError && e.status === 422 && attempt < 2) continue;
      throw e;
    }
  }
  throw new GhError(0, "تعذّر الرفع بعد عدة محاولات.");
}
