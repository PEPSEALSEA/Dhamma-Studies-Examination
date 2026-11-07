# โครงสร้าง Google Sheet (ฐานข้อมูล)

สร้าง Google Sheet 1 ไฟล์ มี 4 แท็บ **ชื่อแท็บต้องตรงตัวพิมพ์เล็กตามนี้** แถวที่ 1 คือชื่อคอลัมน์
ไฟล์ CSV ตัวอย่างอยู่ที่ `data/templates/` (File → Import → Upload ในแต่ละแท็บได้เลย)

| แท็บ | คอลัมน์ |
|---|---|
| `subjects` | `id`, `name`, `description` |
| `questions` | `id`, `year`, `subject`, `question`, `choice_a`, `choice_b`, `choice_c`, `choice_d`, `answer`, `explanation`, `source` |
| `study` | `id`, `subject`, `order`, `title`, `content` |
| `research` | `year`, `title`, `summary`, `source`, `url` |

กฎสำคัญ
- `questions.subject` และ `study.subject` ต้องตรงกับ `subjects.id`
- `questions.year` เป็นปี พ.ศ. (เช่น 2567) ใช้จัดกลุ่มเป็นชุด Mock test
- `answer` ใส่ `a`/`b`/`c`/`d` ตัวพิมพ์เล็ก
- ข้อที่มีแค่ 3 ตัวเลือก ปล่อย `choice_d` ว่างได้
- ทุกข้อควรใส่ `source` (ที่มาของข้อสอบ/ข้อมูล)

## เชื่อมกับ API
1. ในชีต กด Share → General access → **Anyone with the link: Viewer**
2. คัดลอก Sheet ID จาก URL `https://docs.google.com/spreadsheets/d/<SHEET_ID>/edit`
3. ใส่ใน `api/wrangler.jsonc` ที่ `vars.SHEET_ID` (ถ้าเว้นว่าง ระบบใช้ข้อมูลตัวอย่าง)
4. ข้อมูลถูก cache ไว้ 5 นาที (`CACHE_SECONDS`) แก้ชีตแล้วรอสักครู่จึงเห็นผล

> ชีตเป็นแบบอ่านอย่างเดียวผ่านเว็บ จึงไม่ควรใส่ข้อมูลส่วนตัว/ความลับในชีตนี้
