import AsyncStorage from "@react-native-async-storage/async-storage";
import { howVerified, Item } from "./data";
import { dayKey } from "./game";
import { listTree, readFile } from "./github";

export type WFile = { path: string; content: string; original: string | null; editable: boolean };
export type Workspace = {
  base: string;
  files: WFile[];
  readme: string;
  hasTests: boolean;
  support: Record<string, string>; // ملفات يحتاجها تشغيل الاختبارات ولا تظهر في المحرر
  defaultFile: string;
  commitVerb: string;
};

const MAX_SIZE = 100_000;
const draftKey = (p: string) => `pj.draft.${p}`;

export async function saveDraft(path: string, content: string) {
  await AsyncStorage.setItem(draftKey(path), content).catch(() => {});
}
export async function clearDrafts(paths: string[]) {
  await AsyncStorage.multiRemove(paths.map(draftKey)).catch(() => {});
}

export const isTest = (p: string) => /(^|\/)test_[^/]*\.py$/.test(p) || /(^|\/)conftest\.py$/.test(p);
export const isText = (p: string) => /\.(md|txt)$/i.test(p);

const TEMPLATES = {
  solution: "# اكتب حلك هنا\n",
  journal: (d: string) => `# يوم ${d}\n\n## ماذا تعلمت اليوم؟\n\n\n## ما الذي صعب عليّ؟\n\n\n## خطوتي التالية\n\n`,
  review: "# تقرير مراجعة\n\n## الكود الذي راجعته\n\n\n## ما وجدته (الأخطر أولاً)\n1. \n\n## ما تعلمته من المراجعة\n\n",
  projectReadme: "# اسم المشروع\n\n## ماذا يفعل؟\n\n\n## كيف أشغّله؟\n\n",
  projectMain: 'def main():\n    print("بداية المشروع")\n\n\nif __name__ == "__main__":\n    main()\n',
};

export async function buildWorkspace(item: Item, token: string | null): Promise<Workspace> {
  const tree = await listTree(token);
  const has = (p: string) => tree.some((t) => t.path === p);
  const under = (dir: string) => tree.filter((t) => t.path.startsWith(dir + "/") && (t.size ?? 0) < MAX_SIZE).map((t) => t.path);
  const read = (p: string) => readFile(token, p);
  const c = item.check;
  let ws: Workspace;

  if (c.type === "tests" && c.dir) {
    const base = c.dir;
    const paths = under(base);
    const readme = has(`${base}/README.md`) ? await read(`${base}/README.md`) : `# ${item.title}`;
    const codePaths = paths.filter((p) => !p.endsWith("README.md"));
    const files: WFile[] = await Promise.all(codePaths.map(async (p) => {
      const content = await read(p);
      return { path: p, content, original: content, editable: !isTest(p) };
    }));
    if (!files.some((f) => f.path === `${base}/solution.py`)) {
      files.unshift({ path: `${base}/solution.py`, content: TEMPLATES.solution, original: null, editable: true });
    }
    const support: Record<string, string> = {};
    for (const p of ["pytest.ini", "exercises/conftest.py"]) if (has(p)) support[p] = await read(p);
    ws = { base, files, readme, hasTests: files.some((f) => isTest(f.path)), support, defaultFile: `${base}/solution.py`, commitVerb: "حل" };
  } else if (c.type === "file" && c.path) {
    const path = c.path;
    const exists = has(path);
    const content = exists ? await read(path) : (path.startsWith("reviews/") ? TEMPLATES.review : `# ${item.title}\n\n`);
    ws = {
      base: path.split("/").slice(0, -1).join("/"),
      files: [{ path, content, original: exists ? content : null, editable: true }],
      readme: `# ${item.title}\n\n${howVerified(item)}.\n\nاكتب بأسلوبك وبالتفصيل، ثم اضغط «إرسال».`,
      hasTests: false, support: {}, defaultFile: path, commitVerb: "مراجعة",
    };
  } else if (c.type === "dir" && c.path) {
    const base = c.path;
    const today = `${base}/${dayKey(new Date())}.md`;
    const existing = under(base).filter((p) => p.endsWith(".md")).sort().slice(-6);
    const files: WFile[] = await Promise.all(existing.map(async (p) => {
      const content = await read(p);
      return { path: p, content, original: content, editable: true };
    }));
    if (!files.some((f) => f.path === today)) {
      files.push({ path: today, content: TEMPLATES.journal(dayKey(new Date())), original: null, editable: true });
    }
    ws = {
      base, files, hasTests: false, support: {}, defaultFile: today, commitVerb: "دفتر التعلم",
      readme: `# ${item.title}\n\n${howVerified(item)}.\n\nاكتب كل يوم ملفاً قصيراً: ماذا تعلمت، وما الذي صعب عليك، وخطوتك التالية.`,
    };
  } else if (c.type === "project" && c.path) {
    const base = c.path;
    const paths = under(base).slice(0, 30);
    const files: WFile[] = await Promise.all(paths.map(async (p) => {
      const content = await read(p);
      return { path: p, content, original: content, editable: true };
    }));
    if (!files.length) {
      files.push({ path: `${base}/README.md`, content: TEMPLATES.projectReadme, original: null, editable: true });
      files.push({ path: `${base}/main.py`, content: TEMPLATES.projectMain, original: null, editable: true });
    }
    const support: Record<string, string> = {};
    for (const p of ["pytest.ini", "exercises/conftest.py"]) if (has(p)) support[p] = await read(p);
    const main = files.find((f) => f.path.endsWith("main.py")) ?? files[0];
    ws = {
      base, files, support, defaultFile: main.path, commitVerb: "مشروع",
      hasTests: files.some((f) => isTest(f.path)),
      readme: `# ${item.title}\n\n${howVerified(item)}.\n\nيمكنك إضافة ملفات بزر +، وكتابة اختبارات في ملفات تبدأ بـ test_ ليشغّلها زر «اختبار».`,
    };
  } else {
    throw new Error("هذه الخطوة لا تحتاج المحرر");
  }

  // استرجاع المسودات غير المرسلة
  const keys = ws.files.filter((f) => f.editable).map((f) => draftKey(f.path));
  const drafts = await AsyncStorage.multiGet(keys).catch(() => [] as [string, string | null][]);
  drafts.forEach(([k, v]) => {
    const f = ws.files.find((x) => draftKey(x.path) === k);
    if (f && v != null) f.content = v;
  });
  return ws;
}

export function editorSupported(item: Item) {
  return ["tests", "file", "dir", "project"].includes(item.check.type);
}
