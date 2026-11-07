#!/usr/bin/env python3
"""ขั้น 7: สร้างสรุปติวและแถวสำหรับ Google Sheet จาก My Store

อ่าน store/curriculum.json (ขอบข่ายทางการ) + store/years/*/exam.json + store/analysis/overall.json
เขียน
  store/study/<วิชา>-<ระดับ>.md      สรุปติวอ่านง่าย (เฉพาะในเครื่อง)
  store/sheet/study.json             แถวแท็บ study
  store/sheet/research.json          แถวแท็บ research (สรุปรายปี)
  store/sheet/subjects.json          แถวแท็บ subjects

ข้อความติวเป็นการจัดเรียงของผู้เขียนจากขอบข่ายหลักสูตรและสถิติความถี่ ไม่ได้คัดลอกข้อสอบ
(ส่วน "ข้อที่ออกซ้ำ" ใช้เพื่อชี้จุดสำคัญ และอยู่ใน store/ ซึ่งเก็บเฉพาะในเครื่อง)
"""
import collections
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from analyze import tag, norm  # noqa: E402

STORE = Path("store")
CUR = json.loads((STORE / "curriculum.json").read_text(encoding="utf8"))
INDEX = json.loads((STORE / "index.json").read_text(encoding="utf8"))
AUD_NAME = {k: v["name"] for k, v in CUR["audiences"].items()}
SUB_NAME = {"dhamma": "ธรรมวิภาค", "buddha": "พุทธประวัติ/อนุพุทธประวัติและศาสนพิธี", "benja": "เบญจศีลและเบญจธรรม (วินัย)"}

questions = []
for y in INDEX["years"]:
    p = STORE / "years" / str(y["year"]) / "exam.json"
    if p.exists():
        for q in json.loads(p.read_text(encoding="utf8"))["questions"]:
            q["topic"] = tag(q["subject"], q["question"] + " " + " ".join(q["choices"].values()))
            questions.append(q)

(STORE / "study").mkdir(exist_ok=True)
(STORE / "sheet").mkdir(exist_ok=True)

study_rows = []
for sub in ("dhamma", "buddha", "benja"):
    chapters = CUR["subjects"][sub]["chapters"]
    for aud in ("primary", "secondary", "adult"):
        chs = chapters.get(aud) or chapters["all"]
        qs = [q for q in questions if q["subject"] == sub and q["audience"] in (aud, "all") and q.get("set", 1) == 1]
        topics = collections.Counter(q["topic"] for q in qs)
        years = sorted({q["year"] for q in qs})
        # คำถามที่ออกซ้ำในหลายปี ใช้เป็นจุดท่อง (เฉพาะผู้สอบระดับเดียวกัน)
        grp = collections.defaultdict(list)
        for q in qs:
            grp[norm(q["question"])].append(q)
        repeats = sorted((v for v in grp.values() if len({x["year"] for x in v}) >= 2), key=lambda v: -len({x["year"] for x in v}))[:12]

        md = [f"# ติว {SUB_NAME[sub]} — ธรรมศึกษาชั้นตรี {AUD_NAME[aud]}", "",
              f"ข้อมูลสถิติจากข้อสอบปี {years[0] if years else '-'}–{years[-1] if years else '-'} ({len(qs)} ข้อ ที่ระดับนี้ในวิชานี้)", "",
              "## โครงเนื้อหา (ตามขอบข่ายหลักสูตร ๒๕๖๔)", ""]
        for i, ch in enumerate(chs, 1):
            md.append(f"{i}. **{ch['title']}**")
            md += [f"   - {t}" for t in ch["topics"]]
        md += ["", "## หัวข้อที่ออกสอบบ่อย (นับจากการแท็กคำสำคัญ)", ""]
        md += [f"- {t}: {n} ข้อ" for t, n in topics.most_common(8)]
        if repeats:
            md += ["", "## ข้อที่ออกซ้ำข้ามปี (ควรท่อง)", ""]
            for grp_ in repeats:
                q0 = grp_[0]
                ans = q0["choices"].get(q0["answer"] or "", "?")
                md.append(f"- {q0['question']} → **{ans}** (ปี {', '.join(str(v) for v in sorted({x['year'] for x in grp_}))})")
        (STORE / "study" / f"{sub}-{aud}.md").write_text("\n".join(md) + "\n", encoding="utf8")

        for i, ch in enumerate(chs, 1):
            hot = [t for t, _ in topics.most_common(3)]
            body = "หัวข้อในบทนี้:\n" + "\n".join(f"• {t}" for t in ch["topics"])
            if i == 1 and hot:
                body += "\n\nหัวข้อที่ออกสอบบ่อยในวิชานี้ (สถิติ ๒๕๕๙–๒๕๖๘): " + ", ".join(hot)
            study_rows.append({
                "id": f"{sub}-{aud}-{i}", "subject": sub, "audience": aud, "order": str(i),
                "title": ch["title"], "content": body,
            })

# แท็บ research: สรุปรายปี
overall = json.loads((STORE / "analysis" / "overall.json").read_text(encoding="utf8"))
research_rows = []
for y in INDEX["years"]:
    year = y["year"]
    page = (y["files"][0]["page_url"] if y["files"] else "")
    primary = next((f for f in y["files"] if f["kind"] in ("naktham+dhammasuksa", "dhammasuksa")), y["files"][0] if y["files"] else None)
    if y["status"] == "missing" or not y.get("result"):
        research_rows.append({"year": str(year), "title": "ไม่พบข้อสอบธรรมศึกษาชั้นตรี", "summary": y.get("note", ""), "source": "สำนักงานแม่กองธรรมสนามหลวง", "url": page})
        continue
    ay = json.loads((STORE / "years" / str(year) / "analysis.json").read_text(encoding="utf8"))
    auds = sorted({s["audience"] for s in ay["sections"]})
    tops = collections.Counter()
    for s in ay["sections"]:
        for t, n in s["topics"].items():
            if t != "อื่น ๆ":
                tops[t] += n
    summary = (f"{y['result']['questions']} ข้อ จาก {len(ay['sections'])} ชุด (ระดับ: {', '.join(AUD_NAME.get(a, 'ทุกระดับ' if a == 'all' else a) for a in auds)}). "
               f"หัวข้อที่ออกมาก: {', '.join(t for t, _ in tops.most_common(4))}. "
               f"ข้อที่ซ้ำกับปีอื่น {ay['repeated_in_other_years']} ข้อ. ผ่านตรวจอัตโนมัติ {y['result']['ok']} ข้อ"
               + (f" (ที่เหลือ {y['result']['needs_review']} ข้อรอตรวจมือ)" if y["result"]["needs_review"] else ""))
    research_rows.append({"year": str(year), "title": f"สรุปข้อสอบธรรมศึกษาชั้นตรี พ.ศ. {year}", "summary": summary,
                          "source": "สำนักงานแม่กองธรรมสนามหลวง — ปัญหาและเฉลย", "url": primary["page_url"] if primary else page})

subjects_rows = [
    {"id": "dhamma", "name": "ธรรมวิภาค", "description": "หมวดธรรม ธรรมวิภาค (ทุกะ ติกะ จตุกกะ คิหิปฏิบัติ)"},
    {"id": "buddha", "name": "พุทธประวัติ", "description": "พุทธประวัติ (ประถม) / อนุพุทธประวัติและศาสนพิธี (มัธยม, อุดมศึกษาและประชาชน)"},
    {"id": "benja", "name": "เบญจศีลเบญจธรรม (วินัย)", "description": "วินัย เบญจศีล วิรัติ อานิสงส์ และเบญจธรรม"},
]
for name, rows in (("study", study_rows), ("research", research_rows), ("subjects", subjects_rows)):
    (STORE / "sheet" / f"{name}.json").write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf8")
print("study rows", len(study_rows), "| research rows", len(research_rows))
