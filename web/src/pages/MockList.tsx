import { Link } from "react-router-dom";
import { useTab } from "../api";

export default function MockList() {
  const { data, error } = useTab("questions");
  if (error) return <p className="err">โหลดข้อมูลไม่สำเร็จ: {error}</p>;
  if (!data) return <p>กำลังโหลด…</p>;

  const counts = new Map<string, number>();
  data.forEach((q) => counts.set(q.year, (counts.get(q.year) ?? 0) + 1));
  const years = [...counts.keys()].sort((a, b) => Number(b) - Number(a));

  return (
    <>
      <h1>Mock test รายปี</h1>
      {years.length === 0 && <p className="muted">ยังไม่มีข้อสอบ</p>}
      <div className="grid">
        {years.map((y) => (
          <Link key={y} className="card" to={`/mock/${y}`}>
            <h3>ปี {y}</h3>
            <p>{counts.get(y)} ข้อ</p>
          </Link>
        ))}
      </div>
    </>
  );
}
