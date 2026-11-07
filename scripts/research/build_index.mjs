// ขั้น 1: สร้าง store/index.json จาก REST API ทางการของ news.gongtham.net
// รัน: node scripts/research/build_index.mjs
import fs from "node:fs";
import path from "node:path";

const STORE = path.resolve("store");
const YEARS = [2559, 2560, 2561, 2562, 2563, 2564, 2565, 2566, 2567, 2568]; // 10 ปีล่าสุด (ตามที่ผู้ใช้เลือก)
const API = "https://news.gongtham.net/wp-json/wp/v2/downloads";
const THAI = "๐๑๒๓๔๕๖๗๘๙";
const toArabic = (s) => s.replace(/[๐-๙]/g, (d) => String(THAI.indexOf(d)));

// ชื่อโพสต์ไม่คงที่ ("ปัญหาและเฉลย ..." / "ปัญหาเฉลย พ.ศ.2564") จึงค้นหลายคำแล้วรวมโดยตัด id ซ้ำ
const seen = new Map();
for (const term of ["ปัญหาและเฉลย", "ปัญหาเฉลย"]) {
  const r = await fetch(`${API}?per_page=100&search=${encodeURIComponent(term)}`, { headers: { "user-agent": "Mozilla/5.0 (research script)" } });
  for (const p of await r.json()) seen.set(p.id, p);
}
const posts = [...seen.values()];

const files = posts
  .map((p) => {
    const title = p.title.rendered.replace(/&#8211;|&ndash;/g, "-").trim();
    const year = Number(toArabic(title).match(/พ\.ศ\.\s*(\d{4})/)?.[1]);
    // ชุดที่มีธรรมศึกษาอยู่ด้วย (ธรรมศึกษา หรือ นักธรรม-ธรรมศึกษา) ถึงจะมีข้อสอบธรรมศึกษาชั้นตรี
    // "ปัญหาเฉลย พ.ศ.2564" (ไม่ระบุชุด) = ไฟล์ธรรมศึกษา ตรวจยืนยันเมื่อเปิดไฟล์
    const unspecified = !/ธรรมศึกษา|นักธรรม/.test(title);
    const hasDhammasuksa = /ธรรมศึกษา/.test(title) || unspecified;
    const hasNaktham = /นักธรรม/.test(title);
    return {
      id: p.id,
      year,
      title,
      kind: unspecified ? "unspecified" : hasDhammasuksa && hasNaktham ? "naktham+dhammasuksa" : hasDhammasuksa ? "dhammasuksa" : "naktham",
      has_dhammasuksa_tri: hasDhammasuksa,
      page_url: p.link,
      download_url: `https://news.gongtham.net/?gt_dl=${p.id}`,
    };
  })
  .filter((f) => YEARS.includes(f.year));

const index = {
  generated_at: new Date().toISOString(),
  source: "สำนักงานแม่กองธรรมสนามหลวง — https://news.gongtham.net/download-category/ข้อสอบและเฉลยย้อนหลัง/",
  scope: { level: "ธรรมศึกษาชั้นตรี", years: YEARS },
  years: YEARS.map((year) => {
    const fs_ = files.filter((f) => f.year === year);
    const usable = fs_.filter((f) => f.has_dhammasuksa_tri);
    return {
      year,
      status: usable.length ? "found" : "missing",
      note: usable.length ? "" : "ไม่พบไฟล์ปัญหา/เฉลยธรรมศึกษาในเว็บทางการ (ต้องหาแหล่งทางการอื่น)",
      files: fs_,
    };
  }),
};

fs.mkdirSync(STORE, { recursive: true });
fs.writeFileSync(path.join(STORE, "index.json"), JSON.stringify(index, null, 2));
for (const y of index.years) console.log(y.year, y.status, y.files.map((f) => `${f.id}:${f.kind}`).join(", "));
