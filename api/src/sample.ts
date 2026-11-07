// ข้อมูลตัวอย่าง (ใช้เมื่อยังไม่ได้ตั้ง SHEET_ID) — รูปแบบเดียวกับแถวใน Google Sheet
// หมายเหตุ: เป็นข้อมูลสำหรับทดสอบระบบเท่านั้น ไม่ใช่ข้อสอบจริง
type Row = Record<string, string>;

export const sample: Record<string, Row[]> = {
  subjects: [
    { id: "dhamma", name: "ธรรมวิภาค", description: "หมวดธรรมตามหลักสูตรชั้นตรี (ตัวอย่าง)" },
    { id: "buddha", name: "พุทธประวัติ", description: "พุทธประวัติและอนุพุทธประวัติ (ตัวอย่าง)" },
  ],
  questions: [
    {
      id: "2567-001", year: "2567", subject: "dhamma",
      question: "(ตัวอย่าง) ข้อใดคือพระรัตนตรัย?",
      choice_a: "พระพุทธ พระธรรม พระสงฆ์", choice_b: "ทาน ศีล ภาวนา",
      choice_c: "กาย วาจา ใจ", choice_d: "ศีล สมาธิ ปัญญา",
      answer: "a", explanation: "พระรัตนตรัย คือ พระพุทธ พระธรรม และพระสงฆ์", source: "ข้อมูลตัวอย่าง",
    },
    {
      id: "2567-002", year: "2567", subject: "dhamma",
      question: "(ตัวอย่าง) เบญจศีล มีกี่ข้อ?",
      choice_a: "3", choice_b: "5", choice_c: "8", choice_d: "10",
      answer: "b", explanation: "เบญจ แปลว่า ห้า จึงมี 5 ข้อ", source: "ข้อมูลตัวอย่าง",
    },
    {
      id: "2566-001", year: "2566", subject: "buddha",
      question: "(ตัวอย่าง) พระพุทธเจ้าประสูติที่ใด?",
      choice_a: "สวนลุมพินี", choice_b: "พุทธคยา", choice_c: "สารนาถ", choice_d: "กุสินารา",
      answer: "a", explanation: "ประสูติที่สวนลุมพินี", source: "ข้อมูลตัวอย่าง",
    },
  ],
  study: [
    {
      id: "s1", subject: "dhamma", order: "1", title: "พระรัตนตรัย (ตัวอย่าง)",
      content: "พระรัตนตรัย ประกอบด้วย พระพุทธ พระธรรม และพระสงฆ์\n\nเป็นที่พึ่งสูงสุดของพุทธศาสนิกชน",
    },
  ],
  research: [
    {
      year: "2567", title: "สรุปแนวข้อสอบ ปี 2567 (ตัวอย่าง)",
      summary: "ข้อมูลตัวอย่าง: ออกข้อสอบหมวดธรรมวิภาคเป็นสัดส่วนมากที่สุด",
      source: "ข้อมูลตัวอย่าง", url: "",
    },
  ],
};
