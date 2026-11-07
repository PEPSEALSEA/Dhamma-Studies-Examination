#!/usr/bin/env python3
"""ขั้น 6: วิเคราะห์ข้อสอบรายปี -> store/years/<ปี>/analysis.json, notes.md และ store/analysis/overall.json

- แท็กหัวข้อ (topic) ด้วยกฎคำสำคัญ (heuristic) ตามขอบข่ายหลักสูตร ๒๕๖๔ ในไฟล์ store/curriculum.json
- หาข้อสอบที่ซ้ำข้ามปี/ข้ามระดับ (ข้อความคำถามเหมือนกันหลัง normalize)
- ไม่เปลี่ยนข้อมูลข้อสอบ แค่อ่านและสรุป

รัน: python scripts/research/analyze.py
"""
import collections
import json
import re
from pathlib import Path

STORE = Path("store")
INDEX = json.loads((STORE / "index.json").read_text(encoding="utf8"))

# (ชื่อหัวข้อ, regex) เรียงตามลำดับความเฉพาะเจาะจง: ตรงข้อแรกที่ match ใช้ข้อนั้น
TOPICS = {
    "dhamma": [
        ("อริยสัจ ๔", r"อริยสัจ|ทุกข์|สมุทัย|นิโรธ|มรรค|สัจจ?ะ ?๔|ปริญญา|ปหาน|สัจฉิกิริยา|ภาวนา ?๔"),
        ("อิทธิบาท ๔", r"อิทธิบาท|ฉันทะ|วิริยะ|จิตตะ|วิมังสา"),
        ("พรหมวิหาร/อัปปมัญญา ๔", r"พรหมวิหาร|อัปปมัญญา|เมตตา|กรุณา|มุทิตา|อุเบกขา"),
        ("อคติ ๔", r"อคติ|ฉันทาคติ|โทสาคติ|โมหาคติ|ภยาคติ"),
        ("ปธาน ๔", r"ปธาน|สังวรปธาน|ปหานปธาน|ภาวนาปธาน|อนุรักขนาปธาน"),
        ("มิตรปฏิรูป/มิตรแท้ ๔", r"มิตร|ปอกลอก|ดีแต่พูด|หัวประจบ|ชักชวนในทางฉิบหาย|เพื่อน"),
        ("อบายมุข ๖", r"อบายมุข|ดื่มน้ำเมา|เที่ยวกลางคืน|เล่นการพนัน|เกียจคร้าน|เที่ยวดูการละเล่น|คบคนชั่ว"),
        ("ทิศ ๖", r"ทิศ ?๖|ทิศเบื้อง|บิดามารดา.*ทิศ"),
        ("สามัญญลักษณะ ๓", r"สามัญญลักษณะ|ไตรลักษณ์|อนิจจ|ทุกขตา|อนัตตา"),
        ("อธิปไตย ๓", r"อธิปไตย|อัตตาธิปไตย|โลกาธิปไตย|ธัมมาธิปไตย"),
        ("บุญกิริยาวัตถุ ๓", r"บุญกิริยาวัตถุ|ทานมัย|สีลมัย|ภาวนามัย"),
        ("ตัณหา ๓", r"ตัณหา|กามตัณหา|ภวตัณหา|วิภวตัณหา"),
        ("ญาณ ๓", r"ญาณ"),
        ("อัคคิ ๓", r"อัคคิ|ไฟ"),
        ("อกุศลวิตก/กุศลวิตก ๓", r"วิตก|กามวิตก|พยาบาท|วิหิงสา|เนกขัมม|อัพยาบาท|อวิหิงสา"),
        ("อกุศลมูล/กุศลมูล ๓", r"อกุศลมูล|กุศลมูล|โลภ|โทสะ|โมหะ|อโลภะ|อโทสะ|อโมหะ"),
        ("ทุจริต/สุจริต ๓", r"ทุจริต|สุจริต|กายสุจริต|วจีสุจริต|มโนสุจริต"),
        ("โอวาท ๓", r"โอวาท|ละชั่ว|ทำดี|ทำจิตให้บริสุทธิ์"),
        ("รตนะ/พระรัตนตรัย ๓", r"รตนะ|รัตนะ|รัตนตรัย|พระพุทธ|พระธรรม|พระสงฆ์"),
        ("ธรรมหมวด ๒: อุปการะมาก/โลกบาล/งาม/หาได้ยาก", r"สติ|สัมปชัญญะ|หิริ|โอตตัปปะ|ขันติ|โสรัจจะ|กตัญญู|กตเวที|บุพพการี|ธรรมมีอุปการะ|โลกบาล|ธรรมอัน"),
        ("กรรมฐาน/กาม/บูชา/ปฏิสันถาร/สุข ๒", r"กรรมฐาน|สมถ|วิปัสสนา|กาม|บูชา|ปฏิสันถาร|สุข"),
        ("ความรู้เบื้องต้นธรรมวิภาค/ธรรมศึกษา", r"ธรรมวิภาค|ธรรมศึกษา|ธรรมะ"),
    ],
    "benja": [
        ("เบญจธรรมข้อ ๑ เมตตากรุณา", r"เมตตา|กรุณา"),
        ("เบญจธรรมข้อ ๒ สัมมาอาชีวะ", r"สัมมาอาชีวะ|สัมมาอาชีพ|อาชีพ|อาชีวะ"),
        ("เบญจธรรมข้อ ๓ กามสังวร", r"กามสังวร|สำรวมในกาม|สทารสันโดษ|ปติวัตร|ภรรยา|สามี"),
        ("เบญจธรรมข้อ ๔ สัจจะ", r"สัจจะ|ซื่อตรง|ซื่อสัตย์|เที่ยงธรรม|กตัญญู|สวามิภักดิ์|ไม่หลอกลวง"),
        ("เบญจธรรมข้อ ๕ สติสัมปชัญญะ", r"สติ|สัมปชัญญะ|ไม่ประมาท|ความรอบคอบ"),
        ("ศีลข้อ ๑ ปาณาติปาตา", r"ข้อ ?๑|ปาณาติปาตา|ฆ่า|ทำร้าย|ชีวิต|ทรมาน"),
        ("ศีลข้อ ๒ อทินนาทานา", r"ข้อ ?๒|อทินนาทาน|ลัก|ขโมย|ฉก|ทรัพย์สิน|ฉ้อโกง|โกง"),
        ("ศีลข้อ ๓ กาเมสุมิจฉาจารา", r"ข้อ ?๓|กาเมสุมิจฉาจาร|ประพฤติผิดในกาม|ล่วงละเมิด|บุตร|หญิง"),
        ("ศีลข้อ ๔ มุสาวาทา", r"ข้อ ?๔|มุสาวาท|โกหก|พูดเท็จ|คำพูด|วาจา"),
        ("ศีลข้อ ๕ สุราเมรยมัชชปมาทัฏฐานา", r"ข้อ ?๕|สุรา|เมรัย|ของมึนเมา|ดื่ม|เสพติด|ยาเสพ"),
        ("วิรัติ ๓", r"วิรัติ|สัมปัตตวิรัติ|สมาทานวิรัติ|สมุจเฉทวิรัติ"),
        ("อานิสงส์ของการรักษาศีล/ธรรม", r"อานิสงส์|ผลดี|ประโยชน์"),
        ("วินัย/ความหมายของศีล", r"วินัย|ศีล|ระเบียบ|ปกติ"),
    ],
    "buddha": [
        ("สังคายนา/พระไตรปิฎก", r"สังคายนา|พระไตรปิฎก|อรรถกถา|พระวินัยปิฎก|พระสุตตันตปิฎก|พระอภิธรรมปิฎก"),
        ("ชมพูทวีป/วรรณะ/ความเชื่อ", r"ชมพูทวีป|วรรณะ|ปัจจันตชนบท|มัชฌิมชนบท|ลัทธิ|ความเชื่อ|พราหมณ์"),
        ("ศากยวงศ์/กรุงกบิลพัสดุ์", r"ศากยะ|ศากยวงศ์|กบิลพัสดุ์|โอกกากราช|สีหหนุ|สุทโธทนะ"),
        ("ประสูติ/ขนานพระนาม/อสิตดาบส", r"ประสูติ|ลุมพินี|อสิตดาบส|กาฬเทวิล|ขนานพระนาม|พระลักษณะ|มหาปุริสลักษณะ|อาสภิวาจา|มายา|ปชาบดี"),
        ("ชีวิตคฤหัสถ์/อภิเษก/เทวทูต", r"อภิเษก|ยโสธรา|ราหุล|เทวทูต|พืชมงคล|เทวทัต|หงส์|พิมพา|เจริญอานาปานสติ"),
        ("ทรงผนวช/ทุกรกิริยา", r"ผนวช|ออกบวช|มหาภิเนษกรมณ์|อนุเสนยา|อาฬารดาบส|อุทกดาบส|ทุกรกิริยา|พิมพิสาร|ฉันนะ|กัณฐกะ"),
        ("ตรัสรู้/ผจญมาร/สัตตมหาสถาน", r"ตรัสรู้|มาร|นางสุชาดา|โพธิ|สัตตมหาสถาน|ลอยถาด|ข้าวมธุปายาส|วิมุตติสุข"),
        ("ปฐมเทศนา/ปัญจวัคคีย์/พระอัญญาโกณฑัญญะ", r"ปฐมเทศนา|ธัมมจักกัปปวัตตนสูตร|ปัญจวัคคีย์|โกณฑัญญะ|อัญญาโกณฑัญญะ|เบญจวัคคีย์|อาสาฬหบูชา"),
        ("พระอุรุเวลกัสสปะ/ชฎิล", r"อุรุเวล|ชฎิล|กัสสปะ"),
        ("พระสารีบุตร/พระโมคคัลลานะ", r"สารีบุตร|โมคคัลลานะ|อุปติสสะ|โกลิตะ|สัญชัย|อัครสาวก"),
        ("พระสาวกอื่น/อุบาสก-อุบาสิกา", r"อนาถบิณฑิก|วิสาขา|ยสะ|พระอานนท์|เอตทัคคะ|สาวก|สาวิกา|อุบาสก|อุบาสิกา|ราหุลสามเณร|สามเณร|อัครสาวิกา|พระเถรี"),
        ("ปรินิพพาน/วันสำคัญ/ศาสนพิธี", r"ปรินิพพาน|กุสินารา|มาฆบูชา|วิสาขบูชา|อาสาฬหบูชา|เข้าพรรษา|ออกพรรษา|เทโวโรหณะ|วันธรรมสวนะ|วันพระ|อาราธนา|ศาสนพิธี|เวียนเทียน|กรวดน้ำ|ประเคน|ถวาย"),
        ("พุทธประวัติทั่วไป", r"พระพุทธเจ้า|พระพุทธองค์|พุทธ"),
    ],
}


def norm(s: str) -> str:
    return re.sub(r"[\s\.\?\-–—,;:\(\)\"'“”‘’]+", "", s)


def tag(subject, text):
    for name, rx in TOPICS.get(subject, []):
        if re.search(rx, text):
            return name
    return "อื่น ๆ"


def main():
    all_q = []
    for y in INDEX["years"]:
        p = STORE / "years" / str(y["year"]) / "exam.json"
        if p.exists():
            all_q += json.loads(p.read_text(encoding="utf8"))["questions"]
    for q in all_q:
        q["topic"] = tag(q["subject"], q["question"] + " " + " ".join(q["choices"].values()))

    # ข้อสอบซ้ำข้ามปี (ผู้สอบควรรู้ว่าข้อไหนออกซ้ำบ่อย)
    groups = collections.defaultdict(list)
    for q in all_q:
        groups[(q["subject"], norm(q["question"]))].append(q)
    repeats = []
    for (sub, _), qs in groups.items():
        years = sorted({q["year"] for q in qs})
        if len(years) >= 2:
            ans = collections.Counter(q["choices"].get(q["answer"] or "", "?") for q in qs)
            repeats.append({
                "subject": sub, "question": qs[0]["question"], "years": years, "times": len(qs),
                "answers": dict(ans), "ids": [q["id"] for q in qs],
            })
    repeats.sort(key=lambda r: (-len(r["years"]), -r["times"]))

    out_dir = STORE / "analysis"
    out_dir.mkdir(exist_ok=True)

    overall = {"years": {}, "topic_frequency": {}, "repeated_questions": repeats[:300], "repeated_count": len(repeats)}
    topic_total = collections.defaultdict(collections.Counter)

    for y in INDEX["years"]:
        year = y["year"]
        qs = [q for q in all_q if q["year"] == year]
        ydir = STORE / "years" / str(year)
        ydir.mkdir(parents=True, exist_ok=True)
        if not qs:
            (ydir / "notes.md").write_text(f"# ปี {year}\n\nสถานะ: **ไม่พบข้อสอบธรรมศึกษาชั้นตรี** ในแหล่งทางการ\n\n{y.get('note','')}\n\nไฟล์ที่พบในเว็บแม่กองธรรมสนามหลวง:\n" + "\n".join(f"- {f['title']} ({f['page_url']})" for f in y["files"]) + "\n", encoding="utf8")
            overall["years"][year] = {"status": y["status"], "questions": 0}
            continue
        by = collections.defaultdict(list)
        for q in qs:
            by[(q["audience"], q["subject"])].append(q)
        sections = []
        for (aud, sub), items in sorted(by.items()):
            ans = collections.Counter(q["answer"] for q in items if q["answer"])
            tops = collections.Counter(q["topic"] for q in items)
            for t, n in tops.items():
                topic_total[sub][t] += n
            sections.append({
                "audience": aud, "subject": sub, "questions": len(items),
                "needs_review": sum(1 for q in items if q["needs_review"]),
                "answer_distribution": dict(sorted(ans.items())),
                "all_of_the_above_answers": sum(1 for q in items if q["answer"] and "ถูกทุกข้อ" in q["choices"].get(q["answer"], "")),
                "avg_question_chars": round(sum(len(q["question"]) for q in items) / len(items), 1),
                "topics": dict(tops.most_common()),
            })
        analysis = {"year": year, "status": y["status"], "result": y.get("result"), "sections": sections,
                    "repeated_in_other_years": sum(1 for r in repeats if year in r["years"])}
        (ydir / "analysis.json").write_text(json.dumps(analysis, ensure_ascii=False, indent=2), encoding="utf8")
        overall["years"][year] = {"status": y["status"], "questions": len(qs), "ok": sum(1 for q in qs if not q["needs_review"]), "sections": len(sections), "repeated_in_other_years": analysis["repeated_in_other_years"]}

        rep = json.loads((ydir / "exam.json").read_text(encoding="utf8"))["report"]
        review = [q for q in qs if q["needs_review"]]
        lines = [f"# ข้อสอบธรรมศึกษาชั้นตรี พ.ศ. {year}", "",
                 f"สถานะ: **{y['status']}** — {len(qs)} ข้อ, ผ่านตรวจอัตโนมัติ {len(qs)-len(review)}, ต้องตรวจมือ {len(review)}", "",
                 "## ที่มา"] + [f"- {s['title']} — {s['page_url']} (ไฟล์ในเครื่อง: `{s['file']}`)" for s in rep["sources"]] + ["", "## รายวิชา/ระดับที่พบ", "",
                 "| ระดับผู้สอบ | วิชา | ข้อ | ตรวจมือ | หัวข้อที่ออกมากสุด |", "|---|---|---|---|---|"]
        for s in sections:
            top = ", ".join(f"{k} ({v})" for k, v in list(s["topics"].items())[:3])
            lines.append(f"| {s['audience']} | {s['subject']} | {s['questions']} | {s['needs_review']} | {top} |")
        if review:
            lines += ["", "## ข้อที่ต้องตรวจมือ", ""] + [f"- `{q['id']}` (หน้า {q['page']}): {'; '.join(q['review_reasons'])}" for q in review]
        lines += ["", "## หมายเหตุวิธีสกัด", "- เฉลยอ่านจากตัวหนาในไฟล์ปัญหาและเฉลย (และตรวจไขว้กับตารางเฉลย/บรรทัด \"เฉลยข้อ\" ถ้ามี)",
                  "- หัวข้อ (topic) เป็นการแท็กด้วยกฎคำสำคัญ ไม่ใช่การจัดหมวดอย่างเป็นทางการ", f"- ข้อสอบที่ซ้ำกับปีอื่น: {analysis['repeated_in_other_years']} ข้อ"]
        (ydir / "notes.md").write_text("\n".join(lines) + "\n", encoding="utf8")

    overall["topic_frequency"] = {s: dict(c.most_common()) for s, c in topic_total.items()}
    (out_dir / "overall.json").write_text(json.dumps(overall, ensure_ascii=False, indent=2), encoding="utf8")
    print("questions:", len(all_q), "| repeated across years:", len(repeats))
    for s, c in topic_total.items():
        print(s, c.most_common(5))


if __name__ == "__main__":
    main()
