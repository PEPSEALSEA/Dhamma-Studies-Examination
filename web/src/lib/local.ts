import { useEffect, useState } from "react";

// ข้อมูลชุดติว/สถิติจาก store/ (เฉพาะตอน dev) — ใน build จริงจะไม่มี และ hook จะคืน available=false ทันที
export const LOCAL_ENABLED = import.meta.env.DEV;

export interface TreeSub { id: string; name: string; chapters: Chapter[] }
export interface Chapter { id: string; title: string; pages: [number, number]; topics: Topic[] }
export interface Topic { id: string; title: string; pages: [number, number]; summary?: string; subtopics: Subtopic[] }
export interface Subtopic {
  id: string; title: string; points: string[];
  terms?: { term: string; meaning: string }[];
  keywords?: string[]; mnemonic?: string;
  flashcards?: { q: string; a: string }[];
}
export interface StudyTree { source: string; subjects: TreeSub[] }
export interface Flashcard { id: string; subject: string; subtopic: string; path: string; q: string; a: string }
export interface QMap { id: string; subtopic: string | null; explanation: string | null; evidence: string; path?: string; pages?: [number, number] }
export interface Overall {
  years: Record<string, { status: string; questions: number; ok?: number; sections?: number; repeated_in_other_years?: number }>;
  topic_frequency: Record<string, Record<string, number>>;
  repeated_count: number;
}
export interface EssayHistory {
  sayings: { no: string; pali: string; meaning: string; source: string; group: string }[];
  years: Record<string, { audience: string; matched_sayings: string[] }[]>;
  frequency: Record<string, number>;
}
export interface YearAnalysis {
  year: number;
  sections: { audience: string; subject: string; questions: number; needs_review: number; topics: Record<string, number>; answer_distribution: Record<string, number> }[];
}

export function useLocal<T>(file: string) {
  const [data, setData] = useState<T | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">(LOCAL_ENABLED ? "loading" : "missing");
  useEffect(() => {
    if (!LOCAL_ENABLED) return;
    let alive = true;
    fetch(`/local/${file}`)
      .then((r) => (r.ok && r.headers.get("content-type")?.includes("json") ? r.json() : Promise.reject(new Error("missing"))))
      .then((d: T) => {
        if (alive) {
          setData(d);
          setState("ready");
        }
      })
      .catch(() => alive && setState("missing"));
    return () => {
      alive = false;
    };
  }, [file]);
  return { data, state };
}
