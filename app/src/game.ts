import type { Item, Manual, Phase, Progress, Roadmap } from "./data";

export type FlatItem = Item & { phase: Phase; phaseIndex: number };

export type Badge = { id: string; title: string; desc: string; icon: string; earned: boolean };

export type Game = {
  items: FlatItem[];
  done: Set<string>;
  xp: number;
  maxXp: number;
  level: number;
  levelName: string;
  levelFloor: number;
  nextLevelAt: number | null;
  pct: number;
  phasePct: number[];
  currentPhase: number;
  streak: number;
  bestStreak: number;
  activeToday: boolean;
  week: { label: string; active: boolean; today: boolean }[];
  testsPassed: number;
  next: FlatItem | null;
  badges: Badge[];
};

export function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function isItemDone(id: string, progress: Progress, manual: Manual): boolean {
  return !!progress.items[id]?.done || !!manual[id];
}

export function itemXp(item: Item, rm: Roadmap, progress?: Progress): number {
  const x = rm.xp;
  if (item.kind === "project") return x.project;
  if (item.kind === "review") return x.review;
  return x.topic + (item.check.type === "tests" ? x.tests_bonus : 0);
}

function streaks(days: Set<string>, today: Date) {
  const sorted = [...days].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of sorted) {
    run = prev && dayKey(addDays(new Date(prev + "T12:00:00"), 1)) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  // السلسلة الحالية تستمر إذا عملت اليوم أو أمس
  let cur = 0;
  let cursor = days.has(dayKey(today)) ? today : addDays(today, -1);
  while (days.has(dayKey(cursor))) {
    cur++;
    cursor = addDays(cursor, -1);
  }
  return { cur, best };
}

const WEEKDAYS = ["ح", "ن", "ث", "ر", "خ", "ج", "س"];

export function compute(rm: Roadmap, progress: Progress, manual: Manual, now = new Date()): Game {
  const items: FlatItem[] = rm.phases.flatMap((p, i) => p.items.map((it) => ({ ...it, phase: p, phaseIndex: i })));
  const done = new Set(items.filter((i) => isItemDone(i.id, progress, manual)).map((i) => i.id));
  const xp = items.filter((i) => done.has(i.id)).reduce((s, i) => s + itemXp(i, rm), 0);
  const maxXp = items.reduce((s, i) => s + itemXp(i, rm), 0);

  const levels = [...rm.levels].sort((a, b) => a[0] - b[0]);
  let level = 0;
  levels.forEach(([at], i) => { if (xp >= at) level = i; });
  const nextLevelAt = levels[level + 1]?.[0] ?? null;

  const phasePct = rm.phases.map((p) =>
    p.items.length ? Math.round((p.items.filter((i) => done.has(i.id)).length / p.items.length) * 100) : 0);
  let currentPhase = phasePct.findIndex((v) => v < 100);
  if (currentPhase < 0) currentPhase = rm.phases.length - 1;

  const days = new Set<string>(progress.commit_days || []);
  Object.values(manual).forEach((iso) => days.add(dayKey(new Date(iso))));
  const { cur, best } = streaks(days, now);

  const week = Array.from({ length: 7 }, (_, k) => {
    const d = addDays(now, k - 6);
    return { label: WEEKDAYS[d.getDay()], active: days.has(dayKey(d)), today: k === 6 };
  });

  const testsPassed = items.filter((i) => i.check.type === "tests" && progress.items[i.id]?.done).length;
  const next = items.find((i) => !done.has(i.id)) ?? null;
  const pct = items.length ? Math.round((done.size / items.length) * 100) : 0;
  const p1Tests = items.filter((i) => i.phase.id === "p1" && i.check.type === "tests");

  const badges: Badge[] = [
    { id: "first_push", title: "أول دفعة", desc: "أول commit في المستودع", icon: "rocket", earned: progress.commits >= 1 },
    { id: "first_green", title: "أول اختبار أخضر", desc: "نجحت كل اختبارات تمرين", icon: "checkmark-done", earned: testsPassed >= 1 },
    { id: "streak3", title: "ثلاثة أيام", desc: "3 أيام متتالية من العمل", icon: "flame", earned: best >= 3 },
    { id: "tests5", title: "خمسة تمارين", desc: "5 تمارين ناجحة", icon: "flask", earned: testsPassed >= 5 },
    { id: "streak7", title: "أسبوع ناري", desc: "7 أيام متتالية", icon: "bonfire", earned: best >= 7 },
    { id: "py_basics", title: "أساسيات Python", desc: "كل تمارين المرحلة 1", icon: "logo-python", earned: p1Tests.length > 0 && p1Tests.every((i) => done.has(i.id)) },
    { id: "first_project", title: "أول مشروع", desc: "أنهيت مشروع مرحلة", icon: "construct", earned: items.some((i) => i.kind === "project" && done.has(i.id)) },
    { id: "reviewer", title: "مراجع كود", desc: "أول تقرير مراجعة", icon: "search", earned: items.some((i) => i.kind === "review" && done.has(i.id)) },
    { id: "phase_done", title: "مرحلة كاملة", desc: "أنهيت مرحلة بكل خطواتها", icon: "flag", earned: phasePct.some((v) => v === 100) },
    { id: "streak30", title: "شهر بلا انقطاع", desc: "30 يوماً متتالية", icon: "medal", earned: best >= 30 },
    { id: "halfway", title: "نصف الطريق", desc: "50% من الخريطة", icon: "trending-up", earned: pct >= 50 },
    { id: "graduate", title: "مبرمج حقيقي", desc: "أنهيت الخريطة كلها", icon: "trophy", earned: pct === 100 },
  ];

  return {
    items, done, xp, maxXp, level: level + 1, levelName: levels[level]?.[1] ?? "",
    levelFloor: levels[level]?.[0] ?? 0, nextLevelAt, pct, phasePct, currentPhase,
    streak: cur, bestStreak: best, activeToday: days.has(dayKey(now)), week,
    testsPassed, next, badges,
  };
}

export function timeAgo(iso: string | null): string {
  if (!iso) return "لم تتم المزامنة بعد";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "الآن";
  if (s < 3600) return `قبل ${Math.round(s / 60)} دقيقة`;
  if (s < 86400) return `قبل ${Math.round(s / 3600)} ساعة`;
  return `قبل ${Math.round(s / 86400)} يوم`;
}
