// แตก .rar ของชุดธรรมศึกษาปี ๒๕๖๑-๒๕๖๒ เฉพาะ PDF ชั้นตรี -> store/raw/<ปี>/x/
// รัน: node scripts/research/extract_rar.mjs <ไฟล์.rar> <โฟลเดอร์ปลายทาง>   (ต้อง npm i -D node-unrar-js)
import fs from "node:fs";
import path from "node:path";
import { createExtractorFromData } from "node-unrar-js";

const [, , rar, outDir] = process.argv;
const buf = fs.readFileSync(rar);
const mk = () => createExtractorFromData({ data: Uint8Array.from(buf).buffer });
const parts = (name) => name.split(/[\x5c/]/);

const lister = await mk();
const names = [...lister.getFileList().fileHeaders]
  .filter((h) => !h.flags.directory && parts(h.name).some((p) => p === "ธรรมศึกษาชั้นตรี") && /\.pdf$/i.test(h.name))
  .map((h) => h.name);
console.log("tri pdfs:", names.length);

fs.mkdirSync(outDir, { recursive: true });
const ex = await mk();
let n = 0;
for (const f of ex.extract({ files: names }).files) {
  if (!f.extraction || !f.extraction.length) {
    console.log("no data for", f.fileHeader.name);
    continue;
  }
  const safe = parts(f.fileHeader.name).slice(1).join("__");
  fs.writeFileSync(path.join(outDir, safe), f.extraction);
  n++;
}
console.log("extracted", n);
