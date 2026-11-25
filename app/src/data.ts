import AsyncStorage from "@react-native-async-storage/async-storage";
import fallbackRoadmap from "./roadmap.default.json";

export const REPO = "ayachzawi/python-journey";
export const REPO_URL = `https://github.com/${REPO}`;

export type Check = { type: string; dir?: string; path?: string; min?: number; min_chars?: number; min_files?: number };
export type Item = { id: string; kind: "topic" | "project" | "review"; title: string; check: Check };
export type Phase = {
  id: string; title: string; short: string; weeks: number; goal: string; prompt: string;
  resources: { label: string; url: string }[]; items: Item[];
};
export type Roadmap = {
  version: number; repo: string;
  xp: { topic: number; tests_bonus: number; project: number; review: number };
  levels: [number, string][]; phases: Phase[];
  prompts: { title: string; when: string; text: string }[];
  review_checklist: { title: string; items: string[] }[];
};
export type ItemStatus = { done: boolean; via: string; detail?: string; passed?: number; total?: number; since?: string };
export type Progress = { generated_at: string | null; commits: number; commit_days: string[]; items: Record<string, ItemStatus> };

export const EMPTY_PROGRESS: Progress = { generated_at: null, commits: 0, commit_days: [], items: {} };
export const DEFAULT_ROADMAP = fallbackRoadmap as unknown as Roadmap;

const K = { cache: "pj.cache.v1", manual: "pj.manual.v1", seen: "pj.seen.v1" };

async function fetchJson<T>(path: string): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    // واجهة GitHub أولاً لأنها لا تتأخر بسبب التخزين المؤقت، ثم raw كبديل.
    const api = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}?ref=main`, {
      headers: { Accept: "application/vnd.github.raw+json" },
      signal: ctrl.signal,
    });
    if (api.ok) return (await api.json()) as T;
    const raw = await fetch(`https://raw.githubusercontent.com/${REPO}/main/${path}?t=${Date.now()}`, { signal: ctrl.signal });
    if (raw.ok) return (await raw.json()) as T;
    throw new Error(`HTTP ${api.status}`);
  } finally {
    clearTimeout(timer);
  }
}

export type Cache = { roadmap: Roadmap; progress: Progress; syncedAt: string | null };

export async function loadCache(): Promise<Cache> {
  try {
    const raw = await AsyncStorage.getItem(K.cache);
    if (raw) {
      const c = JSON.parse(raw) as Cache;
      if (c.roadmap?.phases?.length) return c;
    }
  } catch {}
  return { roadmap: DEFAULT_ROADMAP, progress: EMPTY_PROGRESS, syncedAt: null };
}

export async function sync(): Promise<Cache> {
  const [roadmap, progress] = await Promise.all([
    fetchJson<Roadmap>("content/roadmap.json"),
    fetchJson<Progress>("progress.json").catch(() => EMPTY_PROGRESS),
  ]);
  if (!roadmap?.phases?.length) throw new Error("roadmap غير صالح");
  const cache: Cache = { roadmap, progress: progress ?? EMPTY_PROGRESS, syncedAt: new Date().toISOString() };
  await AsyncStorage.setItem(K.cache, JSON.stringify(cache)).catch(() => {});
  return cache;
}

/** الخطوات التي تؤشّر عليها بنفسك: معرّف الخطوة ← تاريخ الإنجاز */
export type Manual = Record<string, string>;

export async function loadManual(): Promise<Manual> {
  try { return JSON.parse((await AsyncStorage.getItem(K.manual)) || "{}"); } catch { return {}; }
}
export async function saveManual(m: Manual) {
  await AsyncStorage.setItem(K.manual, JSON.stringify(m)).catch(() => {});
}
export async function loadSeen(): Promise<string[] | null> {
  try { const v = await AsyncStorage.getItem(K.seen); return v ? JSON.parse(v) : null; } catch { return null; }
}
export async function saveSeen(ids: string[]) {
  await AsyncStorage.setItem(K.seen, JSON.stringify(ids)).catch(() => {});
}

/** رابط مفيد على GitHub لكل خطوة: التمرين، أو إنشاء الملف المطلوب مباشرة من الجوال. */
export function itemLink(item: Item): string | null {
  const c = item.check;
  if (c.type === "tests" && c.dir) return `${REPO_URL}/blob/main/${c.dir}/README.md`;
  if (c.type === "file" && c.path) return `${REPO_URL}/new/main?filename=${encodeURIComponent(c.path)}`;
  if ((c.type === "dir" || c.type === "project") && c.path) return `${REPO_URL}/tree/main/${c.path}`;
  if (c.type === "commits") return `${REPO_URL}/commits/main`;
  return null;
}

export function howVerified(item: Item): string {
  const c = item.check;
  switch (c.type) {
    case "tests": return `ارفع solution.py إلى ${c.dir} وسيُصحَّح تلقائياً`;
    case "commits": return `تُحسب تلقائياً عندما يصل عدد commits إلى ${c.min}`;
    case "file": return `اكتب الملف ${c.path} (${c.min_chars} حرف على الأقل)`;
    case "dir": return `${c.min_files} ملفات داخل ${c.path}/`;
    case "project": return `مجلد ${c.path} فيه README.md وكود`;
    default: return "تؤشّر عليها بنفسك عندما تنتهي";
  }
}
