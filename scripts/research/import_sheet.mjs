// ขั้น 8: นำเข้าข้อมูลจาก My Store เข้า Google Sheet (ฐานข้อมูลของเว็บ) — เฉพาะข้อที่ผ่านตรวจ (needs_review = false)
//
// รัน (ตรวจก่อนไม่เขียนจริง):  node scripts/research/import_sheet.mjs --key <service-account.json> --sheet <SHEET_ID> --dry-run
// รันจริง:                      node scripts/research/import_sheet.mjs --key <service-account.json> --sheet <SHEET_ID>
//
// - ใช้ service account ที่ได้รับสิทธิ์ Editor ในชีต อ่านไฟล์ key จากพาธที่ส่งให้เท่านั้น (ไม่คัดลอก ไม่พิมพ์ค่า)
// - เขียนทับเนื้อหาแท็บ subjects, questions, study, research ทั้งแท็บ (ข้อมูลเดิมในแท็บเหล่านี้ถูกแทนที่)
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const dry = process.argv.includes("--dry-run");
const keyFile = arg("key");
const sheetId = arg("sheet");
if (!keyFile || !sheetId) throw new Error("ต้องระบุ --key <ไฟล์ service account> และ --sheet <SHEET_ID>");

const STORE = path.resolve("store");
const read = (p) => JSON.parse(fs.readFileSync(path.join(STORE, p), "utf8"));
const index = read("index.json");

const qRows = [];
let skipped = 0;
for (const y of index.years) {
  const f = path.join(STORE, "years", String(y.year), "exam.json");
  if (!fs.existsSync(f)) continue;
  for (const q of JSON.parse(fs.readFileSync(f, "utf8")).questions) {
    if (q.needs_review || !q.answer) {
      skipped++;
      continue;
    }
    qRows.push([
      q.id, String(q.year), q.audience, q.subject, String(q.number), q.question,
      q.choices.a ?? "", q.choices.b ?? "", q.choices.c ?? "", q.choices.d ?? "",
      q.answer, "", `แม่กองธรรมสนามหลวง ปัญหาและเฉลย พ.ศ. ${q.year} (หน้า ${q.page})`,
    ]);
  }
}
const obj = (rows, cols) => [cols, ...rows.map((r) => cols.map((c) => String(r[c] ?? "")))];
const tabs = {
  subjects: obj(read("sheet/subjects.json"), ["id", "name", "description"]),
  questions: [["id", "year", "audience", "subject", "number", "question", "choice_a", "choice_b", "choice_c", "choice_d", "answer", "explanation", "source"], ...qRows],
  study: obj(read("sheet/study.json"), ["id", "subject", "audience", "order", "title", "content"]),
  research: obj(read("sheet/research.json"), ["year", "title", "summary", "source", "url"]),
};
for (const [t, v] of Object.entries(tabs)) console.log(t.padEnd(10), v.length - 1, "rows");
console.log("questions skipped (needs_review/no answer):", skipped);
if (dry) process.exit(0);

// ---- service account -> access token (scope เขียนชีต)
const k = JSON.parse(fs.readFileSync(keyFile, "utf8"));
const b64 = (x) => Buffer.from(x).toString("base64url");
const now = Math.floor(Date.now() / 1000);
const unsigned = `${b64(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64(JSON.stringify({ iss: k.client_email, scope: "https://www.googleapis.com/auth/spreadsheets", aud: k.token_uri, iat: now, exp: now + 3600 }))}`;
const jwt = `${unsigned}.${crypto.sign("RSA-SHA256", Buffer.from(unsigned), k.private_key).toString("base64url")}`;
const tok = await (await fetch(k.token_uri, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }) })).json();
if (!tok.access_token) throw new Error("ขอ access token ไม่สำเร็จ");
const H = { authorization: `Bearer ${tok.access_token}`, "content-type": "application/json" };
const api = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}`;
const call = async (url, init) => {
  const r = await fetch(url, { headers: H, ...init });
  if (!r.ok) throw new Error(`${init?.method ?? "GET"} ${url.split("?")[0].slice(-40)} -> HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.json();
};

// ---- ขยายขนาดตารางให้พอ แล้วล้าง+เขียนทีละแท็บ
const meta = await call(`${api}?fields=sheets.properties`);
for (const [tab, values] of Object.entries(tabs)) {
  const p = meta.sheets.find((s) => s.properties.title === tab)?.properties;
  const cols = values[0].length;
  if (!p) {
    await call(`${api}:batchUpdate`, { method: "POST", body: JSON.stringify({ requests: [{ addSheet: { properties: { title: tab, gridProperties: { rowCount: values.length + 50, columnCount: cols } } } }] }) });
  } else if (p.gridProperties.rowCount < values.length + 10 || p.gridProperties.columnCount < cols) {
    await call(`${api}:batchUpdate`, { method: "POST", body: JSON.stringify({ requests: [{ updateSheetProperties: { properties: { sheetId: p.sheetId, gridProperties: { rowCount: Math.max(values.length + 50, p.gridProperties.rowCount), columnCount: Math.max(cols, p.gridProperties.columnCount) } }, fields: "gridProperties(rowCount,columnCount)" } }] }) });
  }
  await call(`${api}/values/${encodeURIComponent(tab)}:clear`, { method: "POST", body: "{}" });
  const CHUNK = 800;
  for (let i = 0; i < values.length; i += CHUNK) {
    const part = values.slice(i, i + CHUNK);
    await call(`${api}/values/${encodeURIComponent(`${tab}!A${i + 1}`)}?valueInputOption=RAW`, { method: "PUT", body: JSON.stringify({ range: `${tab}!A${i + 1}`, majorDimension: "ROWS", values: part }) });
  }
  console.log("written", tab, values.length - 1);
}
