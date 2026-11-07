import { useTab } from "../api";

export default function Research() {
  const { data, error } = useTab("research");
  if (error) return <p className="err">โหลดข้อมูลไม่สำเร็จ: {error}</p>;
  if (!data) return <p>กำลังโหลด…</p>;

  const rows = [...data].sort((a, b) => Number(b.year) - Number(a.year));
  return (
    <>
      <h1>Research รายปี</h1>
      {rows.length === 0 && <p className="muted">ยังไม่มีข้อมูล</p>}
      {rows.map((r, i) => (
        <article className="card" key={i}>
          <h3>ปี {r.year} — {r.title}</h3>
          <p className="pre">{r.summary}</p>
          <p className="muted">
            ที่มา: {r.url ? <a href={r.url} target="_blank" rel="noreferrer">{r.source || r.url}</a> : r.source}
          </p>
        </article>
      ))}
    </>
  );
}
