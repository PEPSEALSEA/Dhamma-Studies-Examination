# ฝึกสอบธรรมศึกษาชั้นตรี (ไม่เป็นทางการ)

เว็บฝึกสอบ/ทบทวนธรรมศึกษาชั้นตรี: ติว แฟลชการ์ด ทำข้อสอบย้อนหลังรายปี และสถิติ
Vite + React (หน้าเว็บ) · Cloudflare Worker (API) · Google Sheet (ฐานข้อมูล)

> **ข้อสอบและเฉลยเป็นลิขสิทธิ์ของสำนักงานแม่กองธรรมสนามหลวง** โปรเจกต์นี้เป็นของผู้จัดทำอิสระ ไม่ได้เกี่ยวข้องหรือได้รับการรับรองจากสำนักงานฯ
> ใช้เพื่อการศึกษาเท่านั้น ตรวจเฉลยกับเอกสารทางการเสมอ: <https://www.gongtham.net>
> หากเจ้าของสิทธิ์ต้องการให้ถอดเนื้อหา แจ้งได้ที่ [Issues](https://github.com/PEPSEALSEA/Dhamma-Studies-Examination/issues) แล้วจะลบโดยเร็ว

## สิ่งที่อยู่ใน / ไม่อยู่ใน repo นี้
| อยู่ใน repo | **ไม่** อยู่ใน repo |
|---|---|
| โค้ดหน้าเว็บ (`web/`), Worker (`api/`) | ตัวข้อสอบ/เฉลย/ไฟล์ PDF (อยู่ใน `store/` ในเครื่องผู้จัดทำ, git-ignored) |
| สคริปต์ดึง/แยกข้อสอบ (`scripts/research/`) | สรุปติว แฟลชการ์ด การวิเคราะห์ (`store/`) |
| เอกสาร (`docs/`) และข้อมูลตัวอย่างที่แต่งขึ้นเอง (`data/templates/`) | key ของ service account, token, รหัสผ่าน, ข้อมูลเครื่องส่วนตัว |

ข้อสอบจริงอยู่ใน Google Sheet แบบ private เท่านั้น และ Worker อ่านผ่าน service account (secret `GOOGLE_PRIVATE_KEY` ตั้งด้วย `wrangler secret put`)
การป้องกันที่ Worker (เป็นเพียงการยับยั้งการดึงข้อมูลเป็นชุด ไม่ใช่การยืนยันตัวตน — header ปลอมได้):
- ตอบเฉพาะคำขอที่มี `Origin` ตรงกับหน้าเว็บของเรา
- `GET /api/questions` ส่งข้อสอบ**โดยไม่มีเฉลย/คำอธิบาย**; เฉลยขอผ่าน `POST /api/check` เฉพาะข้อที่ผู้ใช้ตอบแล้ว (สูงสุด 100 ข้อ/คำขอ)
- จำกัดอัตราต่อ IP (120 คำขอ/นาที) ด้วย Rate Limiting binding ของ Cloudflare

## รัน
```bash
npm install
npm run dev:web        # http://localhost:5173
```
รายละเอียด: [docs/DESIGN.md](docs/DESIGN.md) (หน้าตา) · [docs/STORE.md](docs/STORE.md) (ข้อมูล/สคริปต์) · [docs/SHEET_SCHEMA.md](docs/SHEET_SCHEMA.md) (โครงชีต)

## Deploy
- หน้าเว็บ: GitHub Actions (`.github/workflows/deploy.yml`) → GitHub Pages; ตั้ง repository variable `API_URL` เป็น URL ของ Worker
- API: `npm run deploy -w api` (ต้องตั้ง secret `GOOGLE_PRIVATE_KEY` ก่อน)
- ชุดติว/แฟลชการ์ด/กราฟวิเคราะห์ไม่ถูกแพ็กลงเว็บที่ deploy (โหลดจาก `store/` เฉพาะตอน dev)

## สัญญาอนุญาต
โค้ดในโปรเจกต์นี้ใช้สัญญาอนุญาต MIT (ดู [LICENSE](LICENSE)) **ไม่ครอบคลุมเนื้อหาข้อสอบ/เฉลย** ซึ่งเป็นของสำนักงานแม่กองธรรมสนามหลวง
