import { useTab } from "../api";

export default function Study() {
  const subjects = useTab("subjects");
  const study = useTab("study");
  if (subjects.error || study.error) return <p className="err">โหลดข้อมูลไม่สำเร็จ: {subjects.error ?? study.error}</p>;
  if (!subjects.data || !study.data) return <p>กำลังโหลด…</p>;

  return (
    <>
      <h1>ติวเนื้อหา</h1>
      {subjects.data.map((s) => {
        const items = study.data!
          .filter((i) => i.subject === s.id)
          .sort((a, b) => Number(a.order) - Number(b.order));
        return (
          <section key={s.id}>
            <h2>{s.name}</h2>
            <p className="muted">{s.description}</p>
            {items.length === 0 && <p className="muted">ยังไม่มีเนื้อหา</p>}
            {items.map((i) => (
              <article className="card" key={i.id}>
                <h3>{i.title}</h3>
                <p className="pre">{i.content}</p>
              </article>
            ))}
          </section>
        );
      })}
    </>
  );
}
