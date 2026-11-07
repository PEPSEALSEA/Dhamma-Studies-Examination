import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { shuffle } from "../api";
import { Loading, ProgressBar, Ring } from "../components/ui";
import { type Flashcard, useLocal } from "../lib/local";
import { useActivity, useLocalState } from "../lib/progress";

export default function Flashcards() {
  const { subject = "dhamma" } = useParams();
  const cards = useLocal<Flashcard[]>("study/flashcards.json");
  const [known, setKnown] = useLocalState<Record<string, 0 | 1>>("cards", {});
  const { add } = useActivity();
  const [round, setRound] = useState(0);
  const [onlyNew, setOnlyNew] = useState(true);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [gotNow, setGotNow] = useState(0);
  const [missed, setMissed] = useState<string[]>([]);
  const [retry, setRetry] = useState<string[] | null>(null);

  const pool = useMemo(() => (cards.data ?? []).filter((c) => subject === "all" || c.subject === subject), [cards.data, subject]);
  const deck = useMemo(() => {
    const base = retry ? pool.filter((c) => retry.includes(c.id)) : onlyNew && pool.some((c) => known[c.id] !== 1) ? pool.filter((c) => known[c.id] !== 1) : pool;
    return shuffle(base);
    // known เปลี่ยนระหว่างเล่นต้องไม่สับสำรับใหม่ จึงผูกกับ round/retry/pool/onlyNew เท่านั้น
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool, round, retry, onlyNew]);

  const cur = deck[idx];
  const finished = deck.length > 0 && idx >= deck.length;

  const answer = useCallback(
    (ok: boolean) => {
      if (!cur) return;
      setKnown((p) => ({ ...p, [cur.id]: ok ? 1 : 0 }));
      if (ok) {
        setGotNow((n) => n + 1);
        add(2);
      } else setMissed((m) => [...m, cur.id]);
      setFlipped(false);
      setIdx((i) => i + 1);
    },
    [cur, add, setKnown],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (finished) return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (flipped && e.key === "ArrowRight") answer(true);
      else if (flipped && e.key === "ArrowLeft") answer(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flipped, finished, answer]);

  const restart = (ids: string[] | null) => {
    setRetry(ids);
    setRound((r) => r + 1);
    setIdx(0);
    setFlipped(false);
    setGotNow(0);
    setMissed([]);
  };

  if (cards.state === "loading") return <Loading what="แฟลชการ์ด" />;
  if (cards.state === "missing")
    return <div className="notice">แฟลชการ์ดเปิดได้เฉพาะตอนรันในเครื่อง (ยังไม่เผยแพร่ชุดติว) <Link to="/study">กลับไปหน้าติว</Link></div>;
  if (pool.length === 0) return <p className="muted">ยังไม่มีแฟลชการ์ดในวิชานี้ <Link to="/study">กลับ</Link></p>;

  if (finished) {
    const pct = Math.round((gotNow / deck.length) * 100);
    return (
      <div className="card result">
        <h1>จบรอบนี้แล้ว 🎉</h1>
        <Ring value={pct} label={`${gotNow}/${deck.length}`} />
        <p>จำได้ {gotNow} ใบ · ยังไม่แม่น {missed.length} ใบ</p>
        <div className="row" style={{ justifyContent: "center" }}>
          {missed.length > 0 && <button className="btn" onClick={() => restart(missed)}>ทบทวนที่ยังไม่แม่น ({missed.length})</button>}
          <button className="btn ghost" onClick={() => restart(null)}>เล่นรอบใหม่</button>
          <Link className="btn ghost" to={`/study?subject=${subject}`}>กลับไปติว</Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="deck-top">
        <Link className="icon-btn" to={`/study?subject=${subject}`} aria-label="ปิด" style={{ display: "grid", placeItems: "center", textDecoration: "none" }}>✕</Link>
        <ProgressBar value={(idx / deck.length) * 100} />
        <span className="pill">{Math.min(idx + 1, deck.length)} / {deck.length}</span>
      </div>
      <div className="row" style={{ marginTop: "0.5rem" }}>
        <label className="chip" style={{ cursor: "pointer" }}>
          <input type="checkbox" checked={onlyNew} onChange={(e) => { setOnlyNew(e.target.checked); setRetry(null); restart(null); }} /> เฉพาะที่ยังจำไม่ได้
        </label>
        <span className="muted">{cur?.path.split(" > ").slice(-2).join(" › ")}</span>
      </div>

      {cur && (
        <div className={`flip${flipped ? " on" : ""}`} onClick={() => setFlipped((f) => !f)} role="button" tabIndex={0} aria-label="แตะเพื่อพลิกการ์ด">
          <div className="flip-in">
            <div className="face"><div><small>คำถาม · แตะเพื่อดูคำตอบ</small>{cur.q}</div></div>
            <div className="face back"><div><small>คำตอบ</small>{cur.a}</div></div>
          </div>
        </div>
      )}

      {flipped ? (
        <div className="deck-actions">
          <button className="btn bad" onClick={() => answer(false)}>✗ ยังไม่แม่น</button>
          <button className="btn ok" onClick={() => answer(true)}>✓ จำได้</button>
        </div>
      ) : (
        <button className="btn block ghost" onClick={() => setFlipped(true)}>ดูคำตอบ</button>
      )}
      <p className="muted" style={{ textAlign: "center", marginTop: "0.8rem" }} aria-hidden>เดสก์ท็อป: เว้นวรรคพลิก · ← ยังไม่แม่น · → จำได้</p>
    </>
  );
}
