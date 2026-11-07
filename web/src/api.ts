import { useEffect, useState } from "react";

// ตอน build บน GitHub Actions ตั้ง VITE_API_URL เป็น URL ของ Worker; ตอน dev ใช้ proxy ของ Vite
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";

export interface Subject { id: string; name: string; description: string }
export interface Question {
  id: string; year: string; audience: string; subject: string; question: string;
  choice_a: string; choice_b: string; choice_c: string; choice_d: string;
  source: string; number?: string;
  // เฉลย/คำอธิบายไม่ได้มากับรายการข้อสอบ — ขอผ่าน checkAnswers() เมื่อผู้ใช้ตอบแล้ว
}
export interface CheckResult { ok: boolean; answer: string; explanation: string }

// ส่งคำตอบ (id -> a|b|c|d หรือ "" = ไม่ได้ตอบ) ให้ Worker ตรวจ แล้วได้เฉลยของข้อที่ส่งกลับมาเท่านั้น
export async function checkAnswers(answers: Record<string, string>): Promise<Record<string, CheckResult>> {
  const ids = Object.keys(answers);
  const out: Record<string, CheckResult> = {};
  for (let i = 0; i < ids.length; i += 100) {
    const part = Object.fromEntries(ids.slice(i, i + 100).map((id) => [id, answers[id]]));
    const r = await fetch(`${API_BASE}/api/check`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ answers: part }),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    Object.assign(out, await r.json());
  }
  return out;
}
export interface StudyItem { id: string; subject: string; audience: string; order: string; title: string; content: string }
export interface ResearchItem { year: string; title: string; summary: string; source: string; url: string }

interface Tabs {
  subjects: Subject[]; questions: Question[]; study: StudyItem[]; research: ResearchItem[];
}

// แคชในหน่วยความจำ: ข้ามหน้าไม่ต้องโหลดซ้ำ
const cache = new Map<string, Promise<unknown>>();
function load<K extends keyof Tabs>(tab: K): Promise<Tabs[K]> {
  if (!cache.has(tab)) {
    const p = fetch(`${API_BASE}/api/${tab}`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))));
    p.catch(() => cache.delete(tab));
    cache.set(tab, p);
  }
  return cache.get(tab) as Promise<Tabs[K]>;
}

export function useTab<K extends keyof Tabs>(tab: K) {
  const [data, setData] = useState<Tabs[K] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    load(tab)
      .then((d) => alive && setData(d))
      .catch((e: Error) => alive && setError(e.message));
    return () => { alive = false; };
  }, [tab]);
  return { data, error };
}

export const AUDIENCE_LABEL: Record<string, string> = {
  primary: "ระดับประถมศึกษา", secondary: "ระดับมัธยมศึกษา", adult: "ระดับอุดมศึกษาและประชาชนทั่วไป",
  kson: "กศน.", all: "ทุกระดับ (ชุดเดียว)",
};

export const SUBJECT_LABEL: Record<string, string> = {
  dhamma: "ธรรมวิภาค", buddha: "พุทธประวัติ / อนุพุทธประวัติ", benja: "เบญจศีลเบญจธรรม", essay: "เรียงความแก้กระทู้ธรรม",
};

export const choicesOf = (q: Question) =>
  [["a", q.choice_a], ["b", q.choice_b], ["c", q.choice_c], ["d", q.choice_d]].filter(([, t]) => t) as [string, string][];

export const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
