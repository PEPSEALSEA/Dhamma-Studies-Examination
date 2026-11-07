#!/usr/bin/env python3
"""รวมเนื้อหาติวระดับมัธยม (เขียนด้วยมือจากหนังสือเรียนทางการ) เป็นต้นไม้หัวข้อ แล้วจับคู่กับข้อสอบจริง

อินพุต  store/study/secondary/src/<วิชา>/ch*.json   (บท -> หัวข้อ -> หัวข้อย่อย -> ประเด็น/ศัพท์/แฟลชการ์ด)
         store/years/*/exam.json                       (ข้อสอบระดับ secondary)
เอาต์พุต store/study/secondary/tree.json               ต้นไม้เนื้อหาทั้งหมด (id, หน้าอ้างอิงในหนังสือเรียน)
         store/study/secondary/flashcards.json         แฟลชการ์ดทั้งหมด พร้อม path
         store/study/secondary/question_map.json       ข้อสอบ -> หัวข้อย่อย + คำอธิบายเฉลย + ระดับหลักฐาน
         store/study/secondary/coverage.md             รายงานความครอบคลุม + ข้อที่ยังจับคู่ไม่ได้

คำอธิบายเฉลยประกอบจาก "ประเด็นที่ผู้เขียนสรุป" ของหัวข้อย่อยที่ตรงที่สุด จึงไม่ใช่ข้อความคัดลอกจากหนังสือ
evidence:
  answer-in-notes = ข้อความตัวเลือกที่เป็นเฉลยปรากฏในประเด็นสรุปของหัวข้อย่อย (เชื่อถือได้สูง)
  topic-only      = จับคู่หัวข้อได้ แต่ยังไม่พบข้อความเฉลยในประเด็นสรุป (ควรตรวจ/เติมเนื้อหา)
  none            = จับคู่ไม่ได้
"""
import json
import re
from pathlib import Path

STORE = Path("store")
SRC = STORE / "study" / "secondary" / "src"
OUT = STORE / "study" / "secondary"
SUBJECT_ORDER = ["dhamma", "buddha", "benja", "essay"]
SUBJECT_NAME = {
    "dhamma": "ธรรมวิภาค",
    "buddha": "อนุพุทธประวัติและศาสนพิธี",
    "benja": "เบญจศีลและเบญจธรรม",
    "essay": "เรียงความแก้กระทู้ธรรม",
}
THAI_DIGITS = "๐๑๒๓๔๕๖๗๘๙"
MARKS = "ัิีึืฺุู็่้๊๋์ํ๎"


def norm(s: str) -> str:
    s = "".join(str(THAI_DIGITS.index(c)) if c in THAI_DIGITS else c for c in s)
    s = re.sub(r"[\s\.\,\;\:\?\!\(\)\[\]\"'“”‘’\-–—/\\]+", "", s)
    s = s.replace("ํา", "ำ")
    s = re.sub(f"([{MARKS}])\\1+", r"\1", s)
    return s.lower()


def load_tree():
    tree = {"source": "หนังสือธรรมศึกษา ชั้นตรี ระดับมัธยมศึกษา พ.ศ.๒๕๖๔ (แม่กองธรรมสนามหลวง) — สรุปโดยผู้เขียนจากตำรา ควรให้ผู้รู้ตรวจ", "subjects": []}
    seen = set()
    for sub in SUBJECT_ORDER:
        chapters = []
        for f in sorted((SRC / sub).glob("ch*.json"), key=lambda p: int(re.sub(r"\D", "", p.stem))):
            ch = json.loads(f.read_text(encoding="utf8"))
            chapters.append(ch)
        tree["subjects"].append({"id": sub, "name": SUBJECT_NAME[sub], "chapters": chapters})
        for ch in chapters:
            for t in ch["topics"]:
                for st in t["subtopics"]:
                    for k in ("id", "title", "points"):
                        assert k in st, (st.get("id"), "missing", k)
                    assert st["id"] not in seen, ("duplicate id", st["id"])
                    seen.add(st["id"])
    return tree


def flatten(tree):
    flat = []
    for sub in tree["subjects"]:
        for ch in sub["chapters"]:
            for t in ch["topics"]:
                for st in t["subtopics"]:
                    # หลักฐานในการจับคู่/อธิบาย = ประเด็นสำคัญ + ศัพท์และคำแปล + แฟลชการ์ด + ชื่อหัวข้อ (ล้วนสรุปโดยผู้เขียน)
                    pts = list(st["points"]) + [f"{x['term']} = {x['meaning']}" for x in st.get("terms", [])] + [f"{fc['q']} → {fc['a']}" for fc in st.get("flashcards", [])] + [st["title"]]
                    flat.append({
                        "subject": sub["id"], "id": st["id"], "path": f"{ch['title']} > {t['title']} > {st['title']}",
                        "chapter": ch["title"], "topic": t["title"], "title": st["title"], "pages": t.get("pages"),
                        "points": pts, "keywords": st.get("keywords", []), "terms": st.get("terms", []),
                        "norm_points": [norm(p) for p in pts],
                        "norm_keywords": sorted({norm(k) for k in (st.get("keywords", []) + [x["term"] for x in st.get("terms", [])] + re.split(r"[()/]|\s{2,}", st["title"])) if len(norm(k)) >= 3}),
                        "norm_title": norm(st["title"]),
                        "norm_topic": norm(t["title"]),
                    })
    return flat


def tokens(text: str):
    toks = [norm(w) for w in re.split(r"\s+", text) if w.strip()]
    return [t for t in toks if len(t) >= 3]


def score(st, q_text, a_text, choices_text):
    nq, na = norm(q_text), norm(a_text)
    s = 0.0
    generic = na in ("ถูกทุกข้อ", "ผิดทุกข้อ") or len(na) < 3
    for k in st["norm_keywords"]:
        if k in nq:
            s += 3 + len(k) / 10 + (3 if len(k) >= 6 else 0)
        if na and not generic and len(k) >= 4 and (k in na or (len(na) >= 4 and na in k)):
            s += 5 + (10 if k == na else 0)  # เฉลยตรงกับชื่อหัวข้อ/ศัพท์ของหัวข้อย่อยนั้น
        if k in choices_text:
            s += 0.5
    if st["norm_title"] and st["norm_title"] in nq:
        s += 4
    if st["norm_topic"] and st["norm_topic"] in nq:
        s += 2
    allpts = "".join(st["norm_points"])
    for t in tokens(q_text):
        if t in allpts:
            s += 1.0
    if na and len(na) >= 3 and na in allpts:
        s += 6
    return s


def ngram_cover(a: str, hay: str, n: int = 3) -> float:
    """สัดส่วน n-gram ของข้อความเฉลยที่ปรากฏในประเด็นสรุป (ใช้ตัดสินหลักฐานแบบยืดหยุ่น)"""
    if len(a) < n:
        return 1.0 if a and a in hay else 0.0
    grams = {a[i : i + n] for i in range(len(a) - n + 1)}
    return sum(1 for g in grams if g in hay) / len(grams)


def best_point(st, q_text, a_text):
    na = norm(a_text)
    best, bi = -1.0, 0
    toks = tokens(q_text) + tokens(a_text) * 2
    for i, p in enumerate(st["norm_points"]):
        sc = 0.0
        if na and len(na) >= 3 and na in p:
            sc += 10
        sc += sum(1 for t in toks if t in p)
        if sc > best:
            best, bi = sc, i
    return bi, best


def main():
    tree = load_tree()
    flat = flatten(tree)
    (OUT / "tree.json").write_text(json.dumps(tree, ensure_ascii=False, indent=2), encoding="utf8")

    cards = []
    for sub in tree["subjects"]:
        for ch in sub["chapters"]:
            for t in ch["topics"]:
                for st in t["subtopics"]:
                    for i, fc in enumerate(st.get("flashcards", []), 1):
                        cards.append({"id": f"{st['id']}.fc{i}", "subject": sub["id"], "subtopic": st["id"], "path": f"{ch['title']} > {t['title']} > {st['title']}", "q": fc["q"], "a": fc["a"]})
    (OUT / "flashcards.json").write_text(json.dumps(cards, ensure_ascii=False, indent=2), encoding="utf8")

    questions = []
    for y in range(2559, 2569):
        p = STORE / "years" / str(y) / "exam.json"
        if p.exists():
            questions += [q for q in json.loads(p.read_text(encoding="utf8"))["questions"] if q["audience"] == "secondary"]

    qmap, unmapped = [], []
    stats = {s: {"total": 0, "evidence": 0, "topic": 0, "none": 0} for s in SUBJECT_ORDER}
    by_year = {}
    for q in questions:
        sub = q["subject"]
        cands = [st for st in flat if st["subject"] == sub]
        a_letter = q["answer"]
        a_text = q["choices"].get(a_letter, "") if a_letter else ""
        choices_text = norm(" ".join(q["choices"].values()))
        ranked = sorted(((score(st, q["question"], a_text, choices_text), st) for st in cands), key=lambda x: -x[0])
        sc, st = ranked[0]
        stats[sub]["total"] += 1
        rec = {"id": q["id"], "year": q["year"], "subject": sub, "number": q["number"], "answer": a_letter, "answer_text": a_text}
        if sc < 3:
            label = {"a": "ก", "b": "ข", "c": "ค", "d": "ง"}.get(a_letter or "", "?")
            rec.update({"subtopic": None, "evidence": "none", "explanation": f"เฉลย {label}. {a_text} — ตามเฉลยทางการ ข้อนี้อยู่นอกตำราฉบับ ๒๕๖๔ หรือเป็นเนื้อหาหลักสูตรเดิม ยังไม่มีสรุปในชุดติวนี้"})
            stats[sub]["none"] += 1
            unmapped.append((q, sc))
        else:
            bi, bsc = best_point(st, q["question"], a_text)
            point = st["points"][bi]
            na = norm(a_text)
            allp = "".join(st["norm_points"])
            if na in ("ถูกทุกข้อ", "ผิดทุกข้อ"):
                ev = "answer-in-notes"  # เฉลยแบบรวมทุกข้อ: หลักฐานคือหัวข้อที่ตรงกัน ตัวเลือกอื่นต้องถูก/ผิดตามหัวข้อ
            else:
                ev = "answer-in-notes" if na and len(na) >= 3 and (na in allp or ngram_cover(na, allp) >= 0.75) else "topic-only"
            stats[sub]["evidence" if ev == "answer-in-notes" else "topic"] += 1
            label = {"a": "ก", "b": "ข", "c": "ค", "d": "ง"}.get(a_letter or "", "?")
            ref = f"{st['topic']} › {st['title']} (หนังสือเรียนหน้า {st['pages'][0]}–{st['pages'][1]})"
            if ev == "answer-in-notes":
                text = f"เฉลย {label}. {a_text} — เนื้อหาอยู่ในหัวข้อ {ref} สรุปว่า: {point}"
            else:
                text = f"เฉลย {label}. {a_text} — ข้อนี้เกี่ยวกับหัวข้อ {ref} ที่เกี่ยวข้อง: {point} (เป็นข้อประยุกต์/รายละเอียดที่ยังไม่มีในสรุป ให้ยึดเฉลยทางการ)"
            rec.update({"subtopic": st["id"], "path": st["path"], "pages": st["pages"], "evidence": ev, "score": round(sc, 1), "explanation": text})
        qmap.append(rec)
        yy = by_year.setdefault(q["year"], {"total": 0, "evidence": 0, "topic": 0, "none": 0})
        yy["total"] += 1
        yy["evidence" if rec["evidence"] == "answer-in-notes" else "topic" if rec["evidence"] == "topic-only" else "none"] += 1
    weak = [r for r in qmap if r["evidence"] != "answer-in-notes" and int(r["year"]) >= 2565]
    (OUT / "gaps_2565plus.json").write_text(json.dumps(weak, ensure_ascii=False, indent=1), encoding="utf8")
    (OUT / "question_map.json").write_text(json.dumps(qmap, ensure_ascii=False, indent=2), encoding="utf8")

    qcount = {}
    for r in qmap:
        if r["subtopic"]:
            qcount[r["subtopic"]] = qcount.get(r["subtopic"], 0) + 1
    md_dir = OUT / "md"
    md_dir.mkdir(exist_ok=True)
    for sub in tree["subjects"]:
        md = [f"# {sub['name']} — ธรรมศึกษาชั้นตรี ระดับมัธยมศึกษา", "", "> สรุปโดยผู้เขียนจากหนังสือเรียน (แม่กองธรรมสนามหลวง ๒๕๖๔) — เก็บในเครื่องเท่านั้น ควรให้ผู้รู้ตรวจ", ""]
        for ch in sub["chapters"]:
            md += [f"## {ch['title']}", ""]
            for t in ch["topics"]:
                md += [f"### {t['title']} (หน้า {t['pages'][0]}–{t['pages'][1]})", "", t.get("summary", ""), ""]
                for st in t["subtopics"]:
                    md += [f"#### {st['title']}  `{st['id']}` · ข้อสอบที่เกี่ยวข้อง {qcount.get(st['id'], 0)} ข้อ", ""]
                    md += [f"- {x}" for x in st["points"]]
                    if st.get("terms"):
                        md += ["", "**ศัพท์/คำแปล**"] + [f"- {x['term']} = {x['meaning']}" for x in st["terms"]]
                    if st.get("mnemonic"):
                        md += ["", f"**จำง่าย:** {st['mnemonic']}"]
                    if st.get("flashcards"):
                        md += ["", "**แฟลชการ์ด**"] + [f"- Q: {x['q']}  →  A: {x['a']}" for x in st["flashcards"]]
                    md.append("")
        (md_dir / f"{sub['id']}.md").write_text(chr(10).join(md) + chr(10), encoding="utf8")

    lines = ["# รายงานความครอบคลุมเนื้อหาติว (มัธยม)", "", f"หัวข้อย่อยทั้งหมด {len(flat)} / แฟลชการ์ด {len(cards)} / ข้อสอบมัธยมที่ตรวจ {len(questions)} ข้อ", "",
             "| วิชา | ข้อ | หลักฐานในสรุป (answer-in-notes) | จับหัวข้อได้แต่ไม่พบเฉลยในสรุป | จับคู่ไม่ได้ |", "|---|---|---|---|---|"]
    for s, v in stats.items():
        lines.append(f"| {SUBJECT_NAME[s]} | {v['total']} | {v['evidence']} | {v['topic']} | {v['none']} |")
    lines += ["", "## ความครอบคลุมรายปี (ปีที่ใช้หลักสูตรเดิมจะมีเนื้อหานอกตำราฉบับ ๒๕๖๔ มาก)", "", "| ปี | ข้อ | หลักฐานในสรุป | ตรงหัวข้อแต่ไม่พบเฉลย | ไม่ตรงตำราปัจจุบัน |", "|---|---|---|---|---|"]
    for y, v in sorted(by_year.items()):
        lines.append(f"| {y} | {v['total']} | {v['evidence']} | {v['topic']} | {v['none']} |")
    lines += ["", "## ตัวอย่างข้อที่จับคู่ไม่ได้ (เรียงตามวิชา)", ""]
    for q, sc in unmapped[:80]:
        lines.append(f"- `{q['id']}` ({q['subject']}) {q['question'][:90]}")
    (OUT / "coverage.md").write_text("\n".join(lines) + "\n", encoding="utf8")

    for y, v in sorted(by_year.items()):
        print(y, v)
    print("subtopics", len(flat), "| flashcards", len(cards), "| questions", len(questions))
    for s, v in stats.items():
        print(s, v)


if __name__ == "__main__":
    main()
