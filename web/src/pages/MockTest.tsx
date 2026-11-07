import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { choicesOf, useTab } from "../api";

const SECONDS_PER_QUESTION = 60;

export default function MockTest() {
  const { year = "" } = useParams();
  const { data, error } = useTab("questions");
  const questions = useMemo(() => (data ?? []).filter((q) => q.year === year), [data, year]);

  const [picked, setPicked] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    if (questions.length && left === null) setLeft(questions.length * SECONDS_PER_QUESTION);
  }, [questions, left]);

  useEffect(() => {
    if (done || left === null) return;
    if (left <= 0) { setDone(true); return; }
    const t = setTimeout(() => setLeft((s) => (s ?? 0) - 1), 1000);
    return () => clearTimeout(t);
  }, [left, done]);

  if (error) return <p className="err">โหลดข้อมูลไม่สำเร็จ: {error}</p>;
  if (!data) return <p>กำลังโหลด…</p>;
  if (questions.length === 0) return <p>ไม่พบข้อสอบปี {year} <Link to="/mock">กลับ</Link></p>;

  const score = questions.filter((q) => picked[q.id] === q.answer.toLowerCase()).length;
  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <>
      <div className="row">
        <h1>ข้อสอบปี {year}</h1>
        {!done && left !== null && <span className="timer">เหลือเวลา {mmss(left)}</span>}
      </div>

      {done && (
        <div className="card result">
          <h2>ได้ {score} / {questions.length} คะแนน ({Math.round((score / questions.length) * 100)}%)</h2>
          <Link to="/mock">เลือกปีอื่น</Link>
        </div>
      )}

      {questions.map((q, n) => {
        const mine = picked[q.id];
        const right = q.answer.toLowerCase();
        return (
          <article className="card" key={q.id}>
            <p><b>{n + 1}.</b> {q.question}</p>
            {choicesOf(q).map(([k, text]) => {
              const cls = done ? (k === right ? "opt ok" : k === mine ? "opt bad" : "opt") : mine === k ? "opt sel" : "opt";
              return (
                <label key={k} className={cls}>
                  <input type="radio" name={q.id} disabled={done} checked={mine === k}
                    onChange={() => setPicked((p) => ({ ...p, [q.id]: k }))} />
                  {k}. {text}
                </label>
              );
            })}
            {done && (
              <p className="muted">
                เฉลย: {right}. {q.explanation} {q.source && <em>(ที่มา: {q.source})</em>}
              </p>
            )}
          </article>
        );
      })}

      {!done && <button onClick={() => setDone(true)}>ส่งคำตอบ</button>}
    </>
  );
}
