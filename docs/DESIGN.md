# แนวทางออกแบบหน้าเว็บ (จากการศึกษาแอปฝึก/ทบทวนยอดนิยม)

เลียน **รูปแบบการใช้งาน (pattern)** ไม่ใช่ทรัพย์สินของแบรนด์: โค้ด สี โลโก้ ภาพ และข้อความในเว็บนี้เขียน/เลือกขึ้นเองทั้งหมด

## สิ่งที่ศึกษา
- Duolingo (หน้าบทเรียน/ฟีดแบ็ก/สตรีค) — [UX analysis](https://uxdesign.cc/duolingos-usability-analyzed-6bb44b0f2366), [สรุป design system (ไม่เป็นทางการ)](https://open-design.ai/plugins/design-system-duolingo/), [streak design](https://desirabilitylab.com/backfill/backfill-2025-46-duolingo-streak-design)
- Quizlet (แฟลชการ์ด/โหมดเรียน) — [screens](https://screensdesign.com/apps/quizlet-study-with-flashcards/?vs=147582), [swipe studying](https://prnewswire.com/news-releases/quizlet-unveils-new-swipe-studying-and-advanced-content-creation-features-300934213.html), [flashcard swipe UI guidance](https://vp0.com/blogs/flashcard-swipe-ui-like-anki-quizlet)

## Pattern ที่นำมาใช้
| Pattern | ที่มา | ที่ใช้ในเว็บนี้ |
|---|---|---|
| แถบความคืบหน้าแบบ pill ด้านบนระหว่างทำข้อสอบ ให้เห็นตำแหน่งตลอด | Duolingo | `ProgressBar` ในหน้าทำข้อสอบ/แฟลชการ์ด |
| ทำทีละข้อ → กด "ตรวจ" → แผงฟีดแบ็กด้านล่าง (เขียว=ถูก แดง=ผิด) มีปุ่ม "ไปต่อ" และคำอธิบายเฉลย | Duolingo | `Quiz` โหมดฝึก |
| ปุ่มหลักทรง chunky มีขอบล่างหนา กดแล้วยุบ | Duolingo | `.btn` |
| สตรีครายวัน + เป้าหมายรายวัน เป็นแรงจูงใจกลับมา | Duolingo | การ์ดสตรีค/เป้าหมายในหน้าแรก |
| แฟลชการ์ดแตะเพื่อพลิก, ตัวนับ "3 / 34", ปุ่ม "จำได้/ยังไม่แม่น" (2 ระดับ) พร้อมปุ่มสำรองแทนการปัดเพื่อการเข้าถึง | Quizlet | `Flashcards` |
| ทบทวนเฉพาะใบที่ยังไม่แม่นหลังจบรอบ | Quizlet | ปุ่ม "ทบทวนที่ยังไม่แม่น" |
| นำทางล่างบนมือถือ (4 แท็บ) / แถบบนบนเดสก์ท็อป | แอปทั่วไป | `Layout` |

## สไตล์ของเรา
- **โทนสี**: ครีมอุ่น + ส้มขมิ้น/ทอง (ไม่ใช้เขียวนกฮูกของ Duolingo) ถูก = เขียว ผิด = แดง ข้อมูลทั่วไป = ฟ้า
- **ฟอนต์**: Noto Sans Thai (fallback Sarabun / system) ตัวใหญ่ อ่านง่ายบนมือถือ
- **รูปทรง**: มุมโค้ง 16px, เงานุ่ม, ปุ่มสูง ≥ 48px, พื้นที่แตะ ≥ 44px
- **ธีม**: สว่าง/มืด สลับได้ จำค่าในเครื่อง
- **ข้อมูลชุดติว**: โหลดจาก `store/` ผ่าน dev server เท่านั้น (`/local/*`) ไม่ถูกแพ็กลง build จึงไม่เผยแพร่เนื้อหามีลิขสิทธิ์ ถ้าไม่มีข้อมูล local หน้าเว็บจะ fallback ไปใช้ข้อมูลจาก API

## รันดู
```bash
npm run dev:web      # เปิด http://localhost:5173 (มือถือใน LAN: http://<IP เครื่อง>:5173)
```
- ข้อสอบ/สรุปรายปีมาจาก Worker (proxy ไปที่ URL ของ Worker โดยอัตโนมัติ เปลี่ยนได้ด้วย env `VITE_PROXY_TARGET`)
- ชุดติว แฟลชการ์ด คำอธิบายเฉลย และกราฟวิเคราะห์ มาจาก `store/` ผ่าน `/local/*` เฉพาะตอน dev เท่านั้น (ดู `web/vite.config.ts`)
- ความคืบหน้า (สตรีค XP การ์ดที่จำได้ ข้อที่เคยผิด) เก็บใน localStorage ของเบราว์เซอร์
