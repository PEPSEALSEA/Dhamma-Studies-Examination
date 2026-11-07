import { useCallback, useEffect, useState } from "react";

// ความคืบหน้าของผู้เรียนเก็บใน localStorage (ไม่มี login)
export function useLocalState<T>(key: string, init: T): [T, (v: T | ((p: T) => T)) => void] {
  const [val, setVal] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : init;
    } catch {
      return init;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch {
      /* โควต้าเต็ม/โหมดส่วนตัว: ข้าม */
    }
  }, [key, val]);
  const set = useCallback((v: T | ((p: T) => T)) => setVal(v), []);
  return [val, set];
}

export const today = () => new Date().toISOString().slice(0, 10);

export interface Activity {
  days: Record<string, number>; // YYYY-MM-DD -> XP ที่ได้ในวันนั้น
}

export function computeStreak(days: Record<string, number>): number {
  let n = 0;
  const d = new Date();
  // ถ้ายังไม่ได้ฝึกวันนี้ ให้เริ่มนับจากเมื่อวาน (สตรีคยังไม่ขาด)
  if (!days[d.toISOString().slice(0, 10)]) d.setDate(d.getDate() - 1);
  while (days[d.toISOString().slice(0, 10)]) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

export function useActivity() {
  const [act, setAct] = useLocalState<Activity>("activity", { days: {} });
  const add = useCallback((xp: number) => setAct((p) => ({ days: { ...p.days, [today()]: (p.days[today()] ?? 0) + xp } })), [setAct]);
  return { days: act.days, streak: computeStreak(act.days), todayXp: act.days[today()] ?? 0, add };
}

export const DAILY_GOAL_XP = 50;

export function useTheme() {
  const [theme, setTheme] = useLocalState<"light" | "dark">("theme", window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  return { theme, toggle: () => setTheme((t) => (t === "dark" ? "light" : "dark")) };
}

export const AUDIENCES = [
  { id: "primary", label: "ประถมศึกษา" },
  { id: "secondary", label: "มัธยมศึกษา" },
  { id: "adult", label: "อุดมศึกษา" },
];

export function useAudience() {
  return useLocalState<string>("audience", "secondary");
}
