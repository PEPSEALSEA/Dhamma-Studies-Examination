import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { AUDIENCE_LABEL, SUBJECT_LABEL, checkAnswers, choicesOf, shuffle, useTab, type CheckResult, type Question } from "../api";
import { ErrorBox, Loading, ProgressBar, Ring } from "../components/ui";
import { type QMap, useLocal } from "../lib/local";
import { useActivity, useLocalState } from "../lib/progress";

interface Attempt { ok: boolean; t: number }
// แสดงคำอธิบายอัตโนมัติเฉพาะข้อที่พบเฉลยในสรุปติวจริง (กันคำอธิบายคลาดเคลื่อนจากการจับคู่หัวข้อ)
const explain = (map: QMap | undefined, key: CheckResult | undefined) =>
  map?.evidence === "answer-in-notes" && map.explanation ? map.explanation : key?.explanation || "เฉลยตามเฉลยทางการของสำนักงานแม่กองธรรมสนามหลวง";
const SECONDS_PER_QUESTION = 60;
const RANDOM_COUNT = 10;
const LETTER = ["ก", "ข", "ค", "ง"];

export default function Quiz() {
  const { year = "", audience = "" } = useParams();
  const [sp] = useSearchParams();
  const subject = sp.get("subject");
  const mode = sp.get("mode") ?? "practice"; // practice | exam | review
  const q = useTab("questions");
  const qmap = useLocal<QMap[]>("study/question_map.json");
  const [attempts, setAttempts] = useLocalState<Record<string, Attempt>>("attempts", {});
  const { add } = useActivity();

  const [seed, setSeed] = useState(0);
  const [retryIds, setRetryIds] = useState<string[] | null>(null);
  const questions = useMemo<Question[]>(() => {
    const all = q.data ?? [];
    if (retryIds) return retryIds.map((id) => all.find((x) => x.id === id)).filter(Boolean) as Question[];
    let pool = all.filter((x) => x.audience === audience && (!subject || x.subject === subject));
    if (year === "random") {
      if (mode === "review") pool = pool.filter((x) => attempts[x.id] && !attempts[x.id].ok);
      return shuffle(pool).slice(0, RANDOM_COUNT);
    }
    pool = pool.filter((x) => x.year === year);
    return pool.sort((a, b) => a.subject.localeCompare(b.subject) || Number(a.number ?? 0) - Number(b.number ?? 0));
    // attempts ไม่ใส่ใน deps เพื่อไม่ให้ชุดคำถามเปลี่ยนระหว่างทำ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data, audience, subject, year, mode, retryIds, seed]);

  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState(false);
  const [finished, setFinished] = useState(false);
  const [left, setLeft] = useState<number | null>(null);
  // เฉลยมาจาก Worker ทีละข้อที่ตอบแล้วเท่านั้น (ไม่ได้ติดมากับรายการข้อสอบ)
  const [keys, setKeys] = useState<Record<string, CheckResult>>({});
  const [graded, setGraded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [netErr, setNetErr] = useState<string | null>(null);
  const [tries, setTries] = useState(0);
  const savedRef = useRef(false);
  const isExam = mode === "exam";

  useEffect(() => {
    setIdx(0); setPicked({}); setChecked(false); setFinished(false); setGraded(false); setNetErr(null); savedRef.current = false;
    setLeft(isExam && questions.length ? questions.length * SECONDS_PER_QUESTION : null);
  }, [questions, isExam]);

  useEffect(() => {
    if (!isExam || finished || left === null) return;
    if (left <= 0) { setFinished(true); return; }
    const t = setTimeout(() => setLeft((s) => (s ?? 0) - 1), 1000);
    return () => clearTimeout(t);
  }, [left, finished, isExam]);

  const correctOf = (x: Question) => keys[x.id]?.answer ?? "";
  const isRight = (x: Question) => !!picked[x.id] && picked[x.id] === correctOf(x);
  const score = questions.filter(isRight).length;

  // จบชุด: ขอเฉลยข้อที่ยังไม่ได้เฉลย (โหมดสอบเฉลยตอนจบ; โหมดฝึกเฉลยมาแล้วทีละข้อ)
  useEffect(() => {
    if (!finished || graded || questions.length === 0) return;
    const missing = questions.filter((x) => !keys[x.id]);
    if (missing.length === 0) { setGraded(true); return; }
    let alive = true;
    setNetErr(null);
    checkAnswers(Object.fromEntries(missing.map((x) => [x.id, picked[x.id] ?? ""])))
      .then((r) => { if (alive) { setKeys((p) => ({ ...p, ...r })); setGraded(true); } })
      .catch((e: Error) => alive && setNetErr(e.message));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished, graded, tries]);

  // บันทึกผลเมื่อตรวจเสร็จ
  useEffect(() => {
    if (!graded || savedRef.current || questions.length === 0) return;
    savedRef.current = true;
    setAttempts((p) => {
      const n = { ...p };
      questions.forEach((x) => { if (picked[x.id]) n[x.id] = { ok: isRight(x), t: Date.now() }; });
      return n;
    });
    add(score * 10 + 5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graded]);

  const checkNow = async (x: Question) => {
    setBusy(true);
    setNetErr(null);
    try {
      const r = await checkAnswers({ [x.id]: picked[x.id] });
      setKeys((p) => ({ ...p, ...r }));
      setChecked(true);
    } catch (e) {
      setNetErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (q.error) return <ErrorBox msg={q.error} />;
  if (!q.data) return <Loading what="ข้อสอบ" />;
  if (questions.length === 0)
    return <div className="notice">{mode === "review" ? "ยังไม่มีข้อที่เคยทำผิดให้ทบทวน 🎉" : "ไม่พบข้อสอบชุดนี้"} <Link to="/practice">กลับ</Link></div>;

  const title = year === "random" ? (mode === "review" ? "ทบทวนข้อที่เคยผิด" : `ฝึกเร็ว · ${SUBJECT_LABEL[subject ?? ""] ?? ""}`) : `ข้อสอบ พ.ศ. ${year} · ${AUDIENCE_LABEL[audience] ?? audience}${subject ? " · " + (SUBJECT_LABEL[subject]?.split(" /")[0] ?? subject) : ""}`;

  // ---------- หน้าสรุปผล ----------
  if (finished && !graded) {
    return netErr
      ? <><ErrorBox msg={`ตรวจคำตอบไม่สำเร็จ (${netErr})`} /><button className="btn" onClick={() => setTries((t) => t + 1)}>ลองอีกครั้ง</button></>
      : <Loading what="ผลการตรวจ" />;
  }
  if (finished) {
    const pct = Math.round((score / questions.length) * 100);
    const wrong = questions.filter((x) => !isRight(x));
    return (
      <>
        <div className="card result">
          <h1>{pct >= 60 ? "เยี่ยมมาก! 🎉" : "สู้ ๆ ทบทวนอีกนิด 💪"}</h1>
          <p className="muted">{title}</p>
          <Ring value={pct} label={`${score}/${questions.length}`} />
          <p>ได้ {pct}% · +{score * 10 + 5} XP</p>
          <div className="row" style={{ justifyContent: "center" }}>
            {wrong.length > 0 && <button className="btn" onClick={() => setRetryIds(wrong.map((x) => x.id))}>ทำข้อที่ผิดอีกครั้ง ({wrong.length})</button>}
            <button className="btn ghost" onClick={() => { setRetryIds(null); setSeed((s) => s + 1); }}>เริ่มใหม่</button>
            <Link className="btn ghost" to="/practice">กลับ</Link>
          </div>
        </div>
        {wrong.length > 0 && <h2>ข้อที่ต้องทบทวน</h2>}
        {wrong.map((x) => <Review key={x.id} x={x} mine={picked[x.id]} key2={keys[x.id]} map={qmap.data?.find((m) => m.id === x.id)} />)}
      </>
    );
  }

  const x = questions[idx];
  const mine = picked[x.id];
  const choices = choicesOf(x);
  const map = qmap.data?.find((m) => m.id === x.id);
  const ok = isRight(x);
  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const next = () => {
    setChecked(false);
    if (idx + 1 >= questions.length) setFinished(true);
    else setIdx(idx + 1);
  };

  return (
    <>
      <div className="q-top">
        <Link to="/practice" className="icon-btn" aria-label="ออก" style={{ display: "grid", placeItems: "center", textDecoration: "none" }}>✕</Link>
        <ProgressBar value={(idx / questions.length) * 100} />
        {left !== null ? <span className="pill">⏱ {mmss(left)}</span> : <span className="pill">{idx + 1}/{questions.length}</span>}
      </div>
      <p className="muted">{title}</p>

      <div className="card q-card">
        <p className="q-text">{x.number ? `${x.number}. ` : ""}{x.question}</p>
        {choices.map(([k, text], i) => {
          const cls = checked ? (k === correctOf(x) ? "ok" : k === mine ? "bad" : "") : mine === k ? "sel" : "";
          return (
            <button key={k} className={`opt ${cls}`} disabled={checked} onClick={() => setPicked((p) => ({ ...p, [x.id]: k }))} aria-pressed={mine === k}>
              <span className="k">{LETTER[i] ?? k}</span>
              <span>{text}</span>
            </button>
          );
        })}
        {isExam && <p className="muted" style={{ marginTop: "0.8rem" }}>โหมดสอบ: จะเฉลยเมื่อทำครบทุกข้อ</p>}
      </div>

      {!checked && (
        <div className="q-actions">
          <div className="q-actions-in">
            {isExam ? (
              <>
                <button className="btn ghost" onClick={() => setIdx(Math.max(0, idx - 1))} disabled={idx === 0}>ก่อนหน้า</button>
                <button className="btn block" onClick={() => (idx + 1 >= questions.length ? setFinished(true) : setIdx(idx + 1))}>{idx + 1 >= questions.length ? "ส่งคำตอบ" : "ข้อถัดไป"}</button>
              </>
            ) : (
              <>
                {netErr && <p className="err" role="alert">ตรวจคำตอบไม่สำเร็จ ({netErr}) ลองอีกครั้ง</p>}
                <button className="btn block" disabled={!mine || busy} onClick={() => checkNow(x)}>{busy ? "กำลังตรวจ…" : "ตรวจคำตอบ"}</button>
              </>
            )}
          </div>
        </div>
      )}

      {checked && (
        <div className={`feedback ${ok ? "ok" : "bad"}`} role="status" aria-live="polite">
          <div className="feedback-in">
            <h3>{ok ? "✓ ถูกต้อง!" : "✗ ยังไม่ถูก"}</h3>
            {!ok && <p><b>เฉลย: {LETTER[choices.findIndex(([k]) => k === correctOf(x))] ?? ""}. {choices.find(([k]) => k === correctOf(x))?.[1]}</b></p>}
            <p className="exp">{explain(map, keys[x.id])}</p>
            <button className={`btn block ${ok ? "ok" : "bad"}`} onClick={next}>{idx + 1 >= questions.length ? "ดูผลสรุป" : "ไปต่อ"}</button>
          </div>
        </div>
      )}
    </>
  );
}

function Review({ x, mine, key2, map }: { x: Question; mine?: string; key2?: CheckResult; map?: QMap }) {
  const choices = choicesOf(x);
  const right = key2?.answer ?? "";
  const label = (k?: string) => (k ? `${LETTER[choices.findIndex(([c]) => c === k)] ?? k}. ${choices.find(([c]) => c === k)?.[1]}` : "ไม่ได้ตอบ");
  return (
    <div className="card">
      <p><b>{x.number ? `${x.number}. ` : ""}{x.question}</b></p>
      <p className="err">คุณตอบ: {label(mine)}</p>
      <p style={{ color: "var(--ok-d)" }}>เฉลย: {label(right)}</p>
      <div className="callout">{explain(map, key2)}</div>
    </div>
  );
}
