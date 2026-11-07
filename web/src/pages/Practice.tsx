import { Link } from "react-router-dom";
import { AUDIENCE_LABEL, SUBJECT_LABEL, useTab } from "../api";
import { Loading, ErrorBox, Seg } from "../components/ui";
import { AUDIENCES, useAudience, useLocalState } from "../lib/progress";

interface Attempt { ok: boolean; t: number }

export default function Practice() {
  const q = useTab("questions");
  const [audience, setAudience] = useAudience();
  const [attempts] = useLocalState<Record<string, Attempt>>("attempts", {});
  if (q.error) return <ErrorBox msg={q.error} />;
  if (!q.data) return <Loading what="ข้อสอบ" />;

  const mine = q.data.filter((x) => x.audience === audience || (audience === "primary" && x.audience === "all"));
  const subjects = [...new Set(mine.map((x) => x.subject))];
  const sets = new Map<string, Map<string, number>>();
  mine.forEach((x) => {
    const m = sets.get(x.year) ?? new Map<string, number>();
    m.set(x.subject, (m.get(x.subject) ?? 0) + 1);
    sets.set(x.year, m);
  });
  const years = [...sets.keys()].sort((a, b) => Number(b) - Number(a));
  const aud = (y: string) => mine.find((x) => x.year === y)?.audience ?? audience;

  return (
    <>
      <h1>ฝึกทำข้อสอบ</h1>
      <Seg value={audience} options={AUDIENCES.map((a) => ({ id: a.id, label: a.label }))} onChange={setAudience} />

      <h2>⚡ ฝึกเร็ว (สุ่ม 10 ข้อ)</h2>
      <div className="grid">
        {subjects.map((s) => (
          <Link key={s} className="card" to={`/practice/random/${audience}?subject=${s}`}>
            <h3>{SUBJECT_LABEL[s] ?? s}</h3>
            <span className="muted">สุ่มจากข้อสอบทุกปี ได้ฟีดแบ็กทันทีทุกข้อ</span>
          </Link>
        ))}
        <Link className="card" to={`/practice/random/${audience}?mode=review`}>
          <h3>🔁 ทบทวนข้อที่เคยผิด</h3>
          <span className="muted">{Object.values(attempts).filter((a) => !a.ok).length} ข้อรอทบทวน</span>
        </Link>
      </div>

      <h2>📚 ข้อสอบย้อนหลังรายปี</h2>
      {years.length === 0 && <p className="muted">ยังไม่มีข้อสอบของระดับนี้</p>}
      {years.map((y) => {
        const m = sets.get(y)!;
        const total = [...m.values()].reduce((a, b) => a + b, 0);
        const a = aud(y);
        return (
          <div className="card" key={y}>
            <div className="row sb">
              <h3>พ.ศ. {y}</h3>
              <span className="muted">{AUDIENCE_LABEL[a] ?? a} · {total} ข้อ</span>
            </div>
            <div className="chips">
              <Link className="chip on" to={`/practice/${y}/${a}?mode=exam`}>ทั้งชุด จับเวลา</Link>
              {[...m.entries()].map(([sid, n]) => (
                <Link key={sid} className="chip" to={`/practice/${y}/${a}?subject=${sid}`}>{SUBJECT_LABEL[sid]?.split(" /")[0] ?? sid} ({n})</Link>
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}
