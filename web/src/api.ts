import { useEffect, useState } from "react";

// ตอน build บน GitHub Actions ตั้ง VITE_API_URL เป็น URL ของ Worker; ตอน dev ใช้ proxy ของ Vite
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";

export interface Subject { id: string; name: string; description: string }
export interface Question {
  id: string; year: string; subject: string; question: string;
  choice_a: string; choice_b: string; choice_c: string; choice_d: string;
  answer: string; explanation: string; source: string;
}
export interface StudyItem { id: string; subject: string; order: string; title: string; content: string }
export interface ResearchItem { year: string; title: string; summary: string; source: string; url: string }

interface Tabs {
  subjects: Subject[]; questions: Question[]; study: StudyItem[]; research: ResearchItem[];
}

export function useTab<K extends keyof Tabs>(tab: K) {
  const [data, setData] = useState<Tabs[K] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(`${API_BASE}/api/${tab}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => alive && setData(d))
      .catch((e: Error) => alive && setError(e.message));
    return () => { alive = false; };
  }, [tab]);
  return { data, error };
}

export const choicesOf = (q: Question) =>
  [["a", q.choice_a], ["b", q.choice_b], ["c", q.choice_c], ["d", q.choice_d]].filter(([, t]) => t) as [string, string][];
