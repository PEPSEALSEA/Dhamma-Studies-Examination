import { SUBJECT_LABEL, useTab } from "../api";
import { Loading, Seg } from "../components/ui";
import { type EssayHistory, type Overall, useLocal } from "../lib/local";
import { computeStreak, useActivity, useLocalState } from "../lib/progress";
import { useState } from "react";

const SUBS = ["dhamma", "buddha", "benja"];

function Bars({ data, max, limit = 10 }: { data: [string, number][]; max?: number; limit?: number }) {
  const rows = data.slice(0, limit);
  const m = max ?? Math.max(1, ...rows.map((r) => r[1]));
  return (
    <>
      {rows.map(([k, v]) => (
        <div className="hbar" key={k}>
          <span className="t" title={k}>{k}</span>
          <div className="bar"><i style={{ width: `${(v / m) * 100}%` }} /></div>
          <b>{v}</b>
        </div>
      ))}
    </>
  );
}

export default function Stats() {
  const overall = useLocal<Overall>("analysis/overall.json");
  const essay = useLocal<EssayHistory>("study/essay_history.json");
  const research = useTab("research");
  const { days } = useActivity();
  const [attempts] = useLocalState<Record<string, { ok: boolean; t: number }>>("attempts", {});
  const [sub, setSub] = useState("dhamma");

  const done = Object.values(attempts);
  const right = done.filter((a) => a.ok).length;
  const last7 = [...Array(7)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const k = d.toISOString().slice(0, 10);
    return [k.slice(5), days[k] ?? 0] as [string, number];
  });

  return (
    <>
      <h1>สถิติ</h1>

      <h2>ของคุณ</h2>
      <div className="stat">
        <div className="card"><b>🔥 {computeStreak(days)}</b><span className="muted">วันติดต่อกัน</span></div>
        <div className="card"><b>{done.length}</b><span className="muted">ข้อที่ทำแล้ว</span></div>
        <div className="card"><b>{done.length ? Math.round((right / done.length) * 100) : 0}%</b><span className="muted">ถูกต้อง (ล่าสุดของแต่ละข้อ)</span></div>
      </div>
      <div className="card">
        <h3>XP 7 วันล่าสุด</h3>
        <Bars data={last7} limit={7} />
      </div>

      <h2>วิเคราะห์ข้อสอบย้อนหลัง</h2>
      {overall.state === "loading" && <Loading what="สถิติ" />}
      {overall.state === "ready" && overall.data && (
        <>
          <div className="card">
            <h3>จำนวนข้อรายปี</h3>
            <Bars data={Object.entries(overall.data.years).map(([y, v]) => [`พ.ศ. ${y}${v.questions ? "" : " (ไม่พบข้อสอบ)"}`, v.questions])} limit={12} />
            <p className="muted">ข้อสอบที่ออกซ้ำข้ามปี: {overall.data.repeated_count} ข้อ — ฝึกข้อซ้ำก่อนได้ประโยชน์ที่สุด</p>
          </div>
          <div className="card">
            <div className="row sb"><h3>หัวข้อที่ออกบ่อย</h3>
              <Seg value={sub} options={SUBS.map((s) => ({ id: s, label: SUBJECT_LABEL[s].split(" /")[0] }))} onChange={setSub} />
            </div>
            <Bars data={Object.entries(overall.data.topic_frequency[sub] ?? {}).filter(([k]) => k !== "อื่น ๆ")} limit={10} />
            <p className="muted">แท็กหัวข้อด้วยคำสำคัญ (ประมาณการ ไม่ใช่การจัดหมวดทางการ)</p>
          </div>
        </>
      )}
      {essay.state === "ready" && essay.data && (
        <div className="card">
          <h3>กระทู้ธรรมที่ออกสอบ (มัธยม)</h3>
          <Bars data={Object.entries(essay.data.frequency).sort((a, b) => b[1] - a[1])} limit={10} />
          <p className="muted">นับเฉพาะปีที่สกัดข้อความข้อสอบเรียงความได้ (พ.ศ. ๒๕๖๕–๒๕๖๘)</p>
        </div>
      )}
      {overall.state === "missing" && <div className="notice">กราฟวิเคราะห์ละเอียดเปิดได้เฉพาะตอนรันในเครื่อง — ด้านล่างคือสรุปรายปีจากฐานข้อมูล</div>}

      <h2>สรุปรายปี</h2>
      {!research.data ? <Loading /> : [...research.data].sort((a, b) => Number(b.year) - Number(a.year)).map((r) => (
        <article className="card" key={r.year}>
          <h3>พ.ศ. {r.year} — {r.title}</h3>
          <p>{r.summary}</p>
          <p className="muted">ที่มา: {r.url ? <a href={r.url} target="_blank" rel="noreferrer">{r.source || r.url}</a> : r.source}</p>
        </article>
      ))}
    </>
  );
}
