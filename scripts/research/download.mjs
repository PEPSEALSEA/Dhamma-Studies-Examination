// ขั้น 3: ดาวน์โหลด PDF/RAR ของปีที่ status = found ลง store/raw/<ปี>/<id>.pdf (ข้ามไฟล์ที่มีแล้ว)
// รัน: node scripts/research/download.mjs
import fs from "node:fs";
import path from "node:path";

const STORE = path.resolve("store");
const index = JSON.parse(fs.readFileSync(path.join(STORE, "index.json"), "utf8"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

for (const y of index.years) {
  for (const f of y.files.filter((x) => x.has_dhammasuksa_tri)) {
    const dir = path.join(STORE, "raw", String(y.year));
    const existing = ["pdf", "rar", "zip"].map((e) => path.join(dir, `${f.id}.${e}`)).find((p) => fs.existsSync(p) && fs.statSync(p).size > 1000);
    if (existing) {
      f.local = path.relative(STORE, existing).replace(/\\/g, "/");
      delete f.download_error;
      console.log("skip", y.year, f.id);
      continue;
    }
    const res = await fetch(f.download_url, { redirect: "follow", headers: { "user-agent": "Mozilla/5.0 (research script)" } });
    const buf = Buffer.from(await res.arrayBuffer());
    // ไฟล์บางปี (2561, 2562 ชุดธรรมศึกษา) เผยแพร่เป็น .rar
    const magic = buf.subarray(0, 4).toString("latin1");
    const ext = magic === "%PDF" ? "pdf" : magic === "Rar!" ? "rar" : magic.startsWith("PK") ? "zip" : null;
    if (!res.ok || !ext) {
      f.download_error = `HTTP ${res.status}, unknown file type (${buf.length} bytes)`;
      console.log("FAIL", y.year, f.id, f.download_error);
      continue;
    }
    const out = path.join(dir, `${f.id}.${ext}`);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(out, buf);
    f.local = path.relative(STORE, out).replace(/\\/g, "/");
    f.bytes = buf.length;
    f.final_url = res.url;
    f.downloaded_at = new Date().toISOString();
    console.log("ok  ", y.year, f.id, buf.length);
    await sleep(1500); // ไม่ยิงถี่เกินไป
  }
}
fs.writeFileSync(path.join(STORE, "index.json"), JSON.stringify(index, null, 2));
