import { Link, useSearchParams } from "react-router-dom";
import { SUBJECT_LABEL, useTab } from "../api";
import { Loading, ProgressBar, SUBJECT_EMOJI, Seg } from "../components/ui";
import { type StudyTree, type Subtopic, useLocal } from "../lib/local";
import { AUDIENCES, useAudience, useLocalState } from "../lib/progress";

const ORDER = ["dhamma", "buddha", "benja", "essay"];

export default function Study() {
  const [params, setParams] = useSearchParams();
  const subject = params.get("subject") ?? "dhamma";
  const [audience, setAudience] = useAudience();
  const tree = useLocal<StudyTree>("study/tree.json");
  const [done, setDone] = useLocalState<Record<string, true>>("understood", {});

  const toggle = (id: string) =>
    setDone((p) => {
      const n = { ...p };
      if (n[id]) delete n[id];
      else n[id] = true;
      return n;
    });

  const hasLocal = tree.state === "ready" && tree.data && audience === "secondary";
  const sub = hasLocal ? tree.data!.subjects.find((s) => s.id === subject) : undefined;

  const allSub: Subtopic[] = sub ? sub.chapters.flatMap((c) => c.topics.flatMap((t) => t.subtopics)) : [];
  const understood = allSub.filter((s) => done[s.id]).length;

  return (
    <>
      <h1>ติวเนื้อหา</h1>
      <div className="row">
        <Seg value={subject} options={ORDER.map((s) => ({ id: s, label: SUBJECT_LABEL[s].split(" /")[0] }))} onChange={(v) => setParams({ subject: v })} />
      </div>
      <div className="row" style={{ marginTop: "0.6rem" }}>
        <span className="muted">ระดับ</span>
        <select value={audience} onChange={(e) => setAudience(e.target.value)} aria-label="ระดับผู้สอบ">
          {AUDIENCES.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
        </select>
      </div>

      {tree.state === "loading" && <Loading what="ชุดติว" />}

      {sub ? (
        <>
          <div className="card" style={{ marginTop: "1rem" }}>
            <div className="row sb">
              <div className="subj">
                <div className="em" aria-hidden>{SUBJECT_EMOJI[subject]}</div>
                <div>
                  <h3>{sub.name}</h3>
                  <span className="muted">เข้าใจแล้ว {understood}/{allSub.length} หัวข้อย่อย</span>
                </div>
              </div>
              <Link className="btn" to={`/study/cards/${subject}`}>🃏 แฟลชการ์ดวิชานี้</Link>
            </div>
            <div style={{ marginTop: "0.7rem" }}><ProgressBar value={allSub.length ? (understood / allSub.length) * 100 : 0} ok={understood === allSub.length && allSub.length > 0} /></div>
          </div>

          {sub.chapters.map((ch, ci) => (
            <details key={ch.id} className="acc" open={ci === 0}>
              <summary>
                <span>{ch.title}</span>
                <span className="muted" style={{ fontWeight: 600 }}>
                  {ch.topics.flatMap((t) => t.subtopics).filter((s) => done[s.id]).length}/{ch.topics.flatMap((t) => t.subtopics).length}
                </span>
              </summary>
              <div className="in">
                {ch.topics.map((t) => (
                  <details key={t.id} className="acc">
                    <summary><span>{t.title}</span><span className="muted" style={{ fontWeight: 600 }}>หน้า {t.pages[0]}–{t.pages[1]}</span></summary>
                    <div className="in">
                      {t.summary && <div className="callout">{t.summary}</div>}
                      {t.subtopics.map((st) => (
                        <div key={st.id} className="sub">
                          <div className="row sb">
                            <h3>{st.title}</h3>
                            <button className={`known${done[st.id] ? " on" : ""}`} onClick={() => toggle(st.id)} aria-pressed={!!done[st.id]}>
                              {done[st.id] ? "✓ เข้าใจแล้ว" : "ทำเครื่องหมายว่าเข้าใจ"}
                            </button>
                          </div>
                          <ul>{st.points.map((p, i) => <li key={i}>{p}</li>)}</ul>
                          {st.terms && st.terms.length > 0 && (
                            <div className="chips">
                              {st.terms.map((x) => <span key={x.term} className="chip" title={x.meaning}>{x.term} = {x.meaning}</span>)}
                            </div>
                          )}
                          {st.mnemonic && <div className="callout tip">💡 จำง่าย: {st.mnemonic}</div>}
                        </div>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            </details>
          ))}
          <p className="muted" style={{ marginTop: "1rem" }}>{tree.data!.source}</p>
        </>
      ) : (
        tree.state !== "loading" && <Fallback subject={subject} audience={audience} localMissing={tree.state === "missing"} />
      )}
    </>
  );
}

// ไม่มีชุดติว local (เว็บจริง/ระดับอื่น) -> ใช้ข้อมูลจากแท็บ study ของ API
function Fallback({ subject, audience, localMissing }: { subject: string; audience: string; localMissing: boolean }) {
  const study = useTab("study");
  if (!study.data) return <Loading />;
  const items = study.data.filter((i) => i.subject === subject && (i.audience || "primary") === audience).sort((a, b) => Number(a.order) - Number(b.order));
  return (
    <>
      <div className="notice" style={{ marginTop: "1rem" }}>
        {localMissing
          ? "ชุดติวละเอียดของระดับมัธยมเปิดได้เฉพาะตอนรันในเครื่อง (ยังไม่เผยแพร่) — ตอนนี้แสดงหัวข้อสรุปจากฐานข้อมูล"
          : "ชุดติวละเอียดมีเฉพาะระดับมัธยมศึกษา — ระดับนี้แสดงหัวข้อสรุปจากฐานข้อมูล"}
      </div>
      {items.length === 0 && <p className="muted">ยังไม่มีเนื้อหาในหัวข้อนี้</p>}
      {items.map((i) => (
        <article className="card" key={i.id}>
          <h3>{i.title}</h3>
          <p style={{ whiteSpace: "pre-wrap" }}>{i.content}</p>
        </article>
      ))}
    </>
  );
}
