// ดาวน์โหลดเอกสารหลักสูตรทางการ (ขอบข่ายธรรมศึกษา ๒๕๖๔ + หนังสือเรียน ธ.ศ.ตรี) ลง store/raw/curriculum/
// รัน: node scripts/research/download_curriculum.mjs
import fs from "node:fs";
import path from "node:path";

const OUT = path.resolve("store/raw/curriculum");
fs.mkdirSync(OUT, { recursive: true });

const DOCS = [
  { id: 4606, name: "scope-2564.pdf", title: "ขอบข่ายธรรมศึกษา ๒๕๖๔" },
  { id: 2744, name: "book-tri-primary-2564.pdf", title: "หนังสือธรรมศึกษา ชั้นตรี ระดับประถมศึกษา พ.ศ. ๒๕๖๔" },
  { id: 2746, name: "book-tri-secondary-2564.pdf", title: "หนังสือธรรมศึกษา ชั้นตรี ระดับมัธยมศึกษา พ.ศ. ๒๕๖๔" },
];

const meta = [];
for (const d of DOCS) {
  const out = path.join(OUT, d.name);
  if (!fs.existsSync(out) || fs.statSync(out).size < 1000) {
    const res = await fetch(`https://news.gongtham.net/?gt_dl=${d.id}`, { redirect: "follow", headers: { "user-agent": "Mozilla/5.0 (research script)" } });
    const buf = Buffer.from(await res.arrayBuffer());
    if (!res.ok || buf.subarray(0, 4).toString() !== "%PDF") {
      console.log("FAIL", d.id, res.status);
      continue;
    }
    fs.writeFileSync(out, buf);
    d.final_url = res.url;
    console.log("ok  ", d.id, buf.length);
  } else console.log("skip", d.id);
  meta.push({ ...d, page_url: `https://news.gongtham.net/?gt_dl=${d.id}`, file: d.name });
}
fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify(meta, null, 2));
