import { Link } from "react-router-dom";
import { SUBJECT_LABEL, useTab } from "../api";
import { ProgressBar, SUBJECT_EMOJI, Seg } from "../components/ui";
import { DAILY_GOAL_XP, AUDIENCES, useActivity, useAudience, useLocalState } from "../lib/progress";

interface Attempt { ok: boolean; t: number }

export default function Home() {
  const [audience, setAudience] = useAudience();
  const { streak, todayXp } = useActivity();
  const [attempts] = useLocalState<Record<string, Attempt>>("attempts", {});
  const [cards] = useLocalState<Record<string, 0 | 1>>("cards", {});
  const q = useTab("questions");

  const bySubject = (s: string) => {
    const all = (q.data ?? []).filter((x) => x.audience === audience && x.subject === s);
    const done = all.filter((x) => attempts[x.id]?.ok).length;
    return { total: all.length, done };
  };
  const knownCards = Object.values(cards).filter((v) => v === 1).length;
  const goal = Math.min(100, (todayXp / DAILY_GOAL_XP) * 100);

  return (
    <>
      <div className="row sb">
        <span className="muted">เลือกระดับผู้สอบ</span>
        <Seg value={audience} options={AUDIENCES.map((a) => ({ id: a.id, label: a.label }))} onChange={setAudience} />
      </div>

      <section className="hero" style={{ marginTop: "0.8rem" }}>
        <h1>สอบธรรมศึกษาชั้นตรีให้ผ่าน</h1>
        <p>ติวทีละหัวข้อ ทบทวนด้วยแฟลชการ์ด แล้วลองทำข้อสอบจริงย้อนหลัง ทุกวันวันละนิดก็พอ</p>
        <Link className="btn" to="/practice">เริ่มฝึกเลย →</Link>
      </section>

      <div className="stat">
        <div className="card"><b>🔥 {streak}</b><span className="muted">วันติดต่อกัน</span></div>
        <div className="card">
          <b>⭐ {todayXp}/{DAILY_GOAL_XP}</b>
          <span className="muted">เป้าหมายวันนี้ (XP)</span>
          <ProgressBar value={goal} ok={goal >= 100} small />
        </div>
        <div className="card"><b>🃏 {knownCards}</b><span className="muted">แฟลชการ์ดที่จำได้</span></div>
      </div>

      <h2>วิชาที่ต้องสอบ</h2>
      <div className="grid">
        {(["dhamma", "buddha", "benja"] as const).map((s) => {
          const { total, done } = bySubject(s);
          return (
            <div key={s} className="card">
              <div className="subj">
                <div className="em" aria-hidden>{SUBJECT_EMOJI[s]}</div>
                <div style={{ flex: 1 }}>
                  <h3>{SUBJECT_LABEL[s]}</h3>
                  <span className="muted">{q.data ? `ทำถูกแล้ว ${done}/${total} ข้อ` : "กำลังโหลด…"}</span>
                  <ProgressBar value={total ? (done / total) * 100 : 0} small />
                </div>
              </div>
              <div className="row" style={{ marginTop: "0.8rem" }}>
                <Link className="btn ghost" to={`/study?subject=${s}`}>ติว</Link>
                <Link className="btn" to={`/practice/random/${audience}?subject=${s}`}>ฝึก 10 ข้อ</Link>
              </div>
            </div>
          );
        })}
        <div className="card">
          <div className="subj">
            <div className="em" aria-hidden>{SUBJECT_EMOJI.essay}</div>
            <div>
              <h3>{SUBJECT_LABEL.essay}</h3>
              <span className="muted">วิชาข้อเขียน ดูกระทู้ที่ออกบ่อยในหน้าสถิติ</span>
            </div>
          </div>
          <div className="row" style={{ marginTop: "0.8rem" }}>
            <Link className="btn ghost" to="/study?subject=essay">ติวกระทู้ ๑๕ บท</Link>
          </div>
        </div>
      </div>
    </>
  );
}
