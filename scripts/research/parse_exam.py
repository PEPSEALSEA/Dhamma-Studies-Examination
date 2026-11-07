#!/usr/bin/env python3
"""ขั้น 5: แยกข้อสอบธรรมศึกษาชั้นตรี จาก PDF ปัญหาและเฉลยของแม่กองธรรมสนามหลวง

อ่านจาก store/raw/<ปี>/ แล้วเขียน store/years/<ปี>/exam.json
เฉลยมาจาก 2 ทางที่ตรวจไขว้กัน
  1) ตัวเลือกที่เป็นตัวหนา (bold) ในหน้าปัญหาและเฉลย
  2) ตารางเฉลย (เช่น "๑.ค. ๑๑.ก.") ที่อยู่ท้ายวิชาในไฟล์ปีเก่า
ไม่เดา: ตัวเลือกไม่ครบ / หาเฉลยไม่ได้ / เฉลยสองทางไม่ตรงกัน / เลขข้อซ้ำหรือขาด -> needs_review

รัน: python scripts/research/parse_exam.py [ปี ...]      ต้องมี: pip install pymupdf
"""
import json
import re
import sys
import warnings
from pathlib import Path

warnings.filterwarnings("ignore")
import pymupdf  # noqa: E402

STORE = Path("store")
INDEX = json.loads((STORE / "index.json").read_text(encoding="utf8"))

THAI_DIGITS = "๐๑๒๓๔๕๖๗๘๙"
MARKS = "ัิีึืฺุู็่้๊๋์ํ๎"
CHOICE = {"ก": "a", "ข": "b", "ค": "c", "ง": "d"}
AUDIENCES = [("ประถม", "primary"), ("มัธยม", "secondary"), ("อุดม", "adult"), ("กศน", "kson")]

# ฟอนต์ใน PDF บางไฟล์ใช้ glyph พิเศษ (Private Use / Latin-1) แทนวรรณยุกต์-สระ -> แปลงกลับเป็นมาตรฐาน
GLYPH_MAP = {
    "": "ิ", "": "ี", "": "ึ", "": "ื",
    "": "่", "": "่", "": "่", "É": "่",
    "": "้", "": "้", "": "้", "Ê": "้",
    "": "๊", "": "๊", "": "๊", "Ë": "๊",
    "": "๋", "": "๋", "": "๋", "Ì": "๋",
    "": "์", "": "์", "": "์", "Í": "์",
    "": "ั", "": "ํ", "": "็",
    "": "ุ", "": "ู", "": "ฺ",
    "": "ญ", "": "ฐ",
}
STRAY = re.compile("[ĚęĝũćŪ�​]")
KEY_RE = re.compile(r"(?<![๐-๙0-9])([๐-๙]{1,3})\s*\.\s*([กขคง])(?![ก-๙])")
Q_RE = re.compile(r"^\s*([๐-๙]{1,3})\s*[\.\)]\s*(.*)$", re.S)
MARKER = re.compile(r"(?<![ก-๙])([กขคง])\s*\.\s*")


def clean(s: str) -> str:
    s = "".join(GLYPH_MAP.get(c, c) for c in s)
    s = STRAY.sub("", s)
    s = re.sub(r"ญ\s*s([ุู])", lambda m: "ญญ" + m.group(1), s)  # ฟอนต์ DilleniaUPC: ญ ซ้อน (กตัญญู) ถูกแตกเป็น 's'
    return re.sub(f"([{MARKS}])\\1+", r"\1", s)


def fix_text(s: str) -> str:
    """แก้ข้อความหลังประกอบคำถาม/ตัวเลือกแล้ว (บางคำถูกแตกข้าม span จึงแก้ตอน clean ไม่ได้)"""
    s = re.sub(r"ญ\s*s\s*([ุู])", lambda m: "ญญ" + m.group(1), s)
    return re.sub(r"\s+", " ", s).strip()


def num(s: str) -> int:
    return int("".join(str(THAI_DIGITS.index(c)) for c in s))


def spans_of(page):
    h = page.rect.height
    out = []
    for b in page.get_text("dict")["blocks"]:
        for ln in b.get("lines", []):
            for sp in ln["spans"]:
                t = clean(sp["text"]).replace("\t", " ")
                if t.strip() == "":
                    continue
                bb = sp["bbox"]
                if re.fullmatch(r"\s*[๐-๙0-9]{1,3}\s*", t) and (bb[1] < 45 or bb[1] > h - 60):
                    continue  # เลขหน้า
                bold = bool(sp["flags"] & 16) or "bold" in sp["font"].lower()
                out.append((t, bold, bb))
    mid = page.rect.width / 2
    # หน้าสองคอลัมน์ (ข้อ ๑-๒๕ ซ้าย / ๒๖-๕๐ ขวา) -> เรียงคอลัมน์ซ้ายทั้งหมดก่อน
    two_col = any(re.match(r"\s*[๐-๙]{1,3}\s*\.", t) and bb[0] > mid - 5 for t, _, bb in out)
    col = (lambda bb: 1 if bb[0] >= mid - 5 else 0) if two_col else (lambda bb: 0)
    out.sort(key=lambda s: (col(s[2]), round(s[2][1] / 4), s[2][0]))  # คอลัมน์ -> บรรทัด -> ซ้าย->ขวา
    return out


def subject_of(seg: str) -> str:
    if "กระทู้" in seg or "เรียงความ" in seg:
        return "essay"
    if "เบญจ" in seg:
        return "benja"
    if "พุทธ" in seg:
        return "buddha"
    return "dhamma"


def heading_of(spans):
    """คืน dict(level, subject, audience) ถ้าหน้านี้เป็นหน้าเริ่มวิชา มิฉะนั้น None
    ทนต่อหัวข้อที่ PDF ทำตัวอักษรซ้ำ (เช่น "วิวิชา", "ชชั้น") โดยไม่ผูกกับการสะกดตายตัว"""
    flat = re.sub(r"\s+", "", "".join(t for t, _, bb in spans if bb[1] < 260))
    m = re.search(r"ธรรมศึกษา.{0,8}?(ตรี|ตร|โท|เอก)", flat)
    if not m and re.match(r"[๐-๙0-9]{0,4}(ปัญหา|เฉลย).{0,40}วิชา", flat) and "สอบในสนามหลวง" in flat:
        i = flat.find("ธรรมศึกษา")
        seg = flat[: i if i > 0 else 60]
        return {"level": "other", "subject": subject_of(seg), "audience": "all", "title": seg, "is_key": flat.lstrip("๐๙0123456789").startswith("เฉลยวิชา")}
    if not m or not ("ปัญหา" in flat or "เฉลยวิชา" in flat):
        return None
    if re.match(r"[๐-๙]{1,3}\s*\.", flat):  # หน้าที่ขึ้นต้นด้วยเลขข้อ = หน้าคำถามปกติ
        return None
    start = min([i for i in (flat.find("ปัญหา"), flat.find("เฉลย")) if i >= 0] or [0])
    seg = flat[start : flat.find("ธรรมศึกษา")]
    # ต้องเป็นหัวข้อ "ปัญหา...วิชา..." ที่ต้นหน้า (ตัดหน้าปก/สารบัญที่เอ่ยถึงธรรมศึกษา)
    if not re.match(r"[๐-๙0-9]{0,4}(ปัญหา|เฉลย)", flat) or not ("วิ" in seg or "ชา" in seg):
        return None
    aud = next((a for key, a in AUDIENCES if key in flat), "all")
    return {"level": "ตรี" if m.group(1) in ("ตรี", "ตร") else m.group(1), "subject": subject_of(seg), "audience": aud, "title": seg}


def is_key_page(spans) -> bool:
    text = " ".join(t for t, _, _ in spans)
    return len(KEY_RE.findall(text)) >= 8 and len(Q_RE.findall(text)) < 3 or (len(KEY_RE.findall(text)) >= 20)


def parse_pdf(pdf: Path, year: int, forced_audience=None):
    doc = pymupdf.open(pdf)
    sections, cur = {}, None
    for pno in range(doc.page_count):
        spans = spans_of(doc[pno])
        if not spans:
            if cur is not None and doc[pno].get_images():
                cur.setdefault("image_pages", []).append(pno + 1)  # หน้าเป็นภาพ ไม่มีชั้นข้อความ -> ต้องอ่านจากภาพ
            continue
        h = heading_of(spans)
        if h and h["level"] == "other" and h.get("is_key") and cur is not None and cur["meta"]["subject"] == h["subject"]:
            h = None  # หน้าตารางเฉลยของวิชาเดิมที่หัวข้อตัวอักษรเพี้ยน -> ถือเป็นหน้าต่อเนื่อง
        if h:
            if forced_audience:
                h["audience"] = forced_audience
            cur = None
            if h["level"] == "ตรี":
                cur = sections.setdefault((h["audience"], h["subject"]), {"meta": h, "pages": [], "spans": [], "keys": {}, "image_pages": []})
        if cur is None:
            continue
        cur["pages"].append(pno + 1)
        if is_key_page(spans):
            text = " ".join(t for t, _, _ in spans)
            for n, letter in KEY_RE.findall(text):
                cur["keys"].setdefault(num(n), CHOICE[letter])
            continue
        if h:  # ตัดข้อความหัวหน้า (ก่อนข้อ ๑) ออก
            ys = [bb[1] for t, _, bb in spans if (Q_RE.match(t) and num(Q_RE.match(t).group(1)) == 1)]
            if ys:
                spans = [s for s in spans if s[2][1] >= min(ys) - 8]
        for t, bold, bb in spans:
            cur["spans"].append((pno + 1, t, bold, bb))
    return sections


def build_questions(sec, year):
    meta = sec["meta"]
    qs, q, cho = [], None, None

    def feed(text, bold):
        nonlocal cho
        if not text.strip():
            return
        cut = re.search(r"-{4,}|ให้เวลา", text)
        if cut:  # เส้นคั่นท้ายวิชา: ข้อความหลังจากนี้ไม่ใช่ตัวข้อสอบ
            text = text[: cut.start()]
            if not text.strip():
                return
        mk = re.search(r"เฉลยข้อ\s*[๐-๙]*\s*\.?\s*([กขคง])", text)
        if mk:  # บรรทัด "เฉลยข้อ ค." ที่ใต้ข้อสอบ (ไฟล์ปี ๒๕๕๙-๒๕๖๐) = เฉลยแบบระบุตรง
            q["inline_key"] = CHOICE[mk.group(1)]
            text = text[: mk.start()]
            if not text.strip():
                return
        pos = 0
        for m in MARKER.finditer(text):
            before = text[pos : m.start()]
            if before.strip():
                add(before, bold)
            cho = CHOICE[m.group(1)]
            if cho in q["choices"]:  # ตัวเลือกซ้ำ -> ผิดปกติ
                q["dup"] = True
            q["choices"][cho] = ""
            if bold:
                q["bold"].add(cho)
            pos = m.end()
        rest = text[pos:]
        if rest.strip():
            add(rest, bold)

    def add(text, bold):
        if cho:
            q["choices"][cho] = (q["choices"][cho] + " " + text.strip()).strip()
            if bold and text.strip():
                q["bold"].add(cho)
        else:
            q["question"] = (q["question"] + " " + text.strip()).strip()

    raw = sec["spans"]
    merged, i = [], 0
    while i < len(raw):
        page, t, bold, bb = raw[i]
        if i + 1 < len(raw) and re.fullmatch(r"\s*[กขคง]\s*", t) and re.match(r"\s*\.", raw[i + 1][1]):
            n = raw[i + 1]  # ตัวอักษรตัวเลือกกับจุดถูกแยกเป็นสอง span
            merged.append((page, t.strip() + n[1], bold or n[2], bb))
            i += 2
            continue
        merged.append(raw[i])
        i += 1
    for page, t, bold, bb in merged:
        mq = Q_RE.match(t)
        if not mq and q is not None:
            # บางข้อพิมพ์เลขข้อโดยไม่มีจุด ("๔๗ มะยัง...") รับเฉพาะเมื่อเป็นเลขถัดไปพอดี
            m2 = re.match(r"^\s*([๐-๙]{1,3})\s+(\S.*)$", t, re.S)
            if m2 and num(m2.group(1)) == q["number"] + 1:
                mq = m2
        if mq and not MARKER.match(t):
            n = num(mq.group(1))
            # รับเลขข้อถัดไป หรือข้ามข้อที่หน้าเป็นภาพ (ข้ามได้ไม่เกิน 8 ข้อ จะถูกบันทึกเป็น missing_numbers)
            if q is None or n == q["number"] + 1 or n == 1 or (q["number"] + 1 < n <= q["number"] + 8 and mq.group(2).strip()):
                q = {"number": n, "question": "", "choices": {}, "bold": set(), "page": page, "restart": q is not None and n == 1}
                qs.append(q)
                cho = None
                feed(mq.group(2), bold)
                continue
        if q is not None:
            feed(t, bold)

    items = []
    for q in qs:
        reasons = []
        if sorted(q["choices"]) != ["a", "b", "c", "d"] or any(not v for v in q["choices"].values()):
            reasons.append(f"ตัวเลือกไม่ครบ ({','.join(sorted(q['choices'])) or 'none'})")
        if q.get("dup"):
            reasons.append("ตัวเลือกซ้ำ")
        if q["restart"]:
            reasons.append("เลขข้อเริ่มที่ 1 ซ้ำในวิชาเดียวกัน (อาจรวมหลายชุด)")
        bold = sorted(q["bold"])
        key = sec["keys"].get(q["number"]) or q.get("inline_key")
        ans, how = None, None
        if len(bold) == 1:
            ans, how = bold[0], "bold"
            if key and key != ans:
                reasons.append(f"เฉลยตัวหนา ({ans}) ไม่ตรงตารางเฉลย ({key})")
            elif key:
                how = "bold+key"
        elif key and len(bold) == 0:
            ans, how = key, "key"
        else:
            reasons.append(f"หาเฉลยไม่ได้ชัด (ตัวหนา {len(bold)} ตัวเลือก, ตารางเฉลย {'มี' if key else 'ไม่มี'})")
        if not q["question"]:
            reasons.append("ไม่มีตัวคำถาม")
        if re.search(r"[A-Za-z]", fix_text(q["question"] + " " + " ".join(q["choices"].values()))):
            reasons.append("มีอักขระละติน (อาจเป็น glyph เพี้ยนจากฟอนต์)")
        items.append({
            "id": f"{year}-tri-{meta['audience']}-{meta['subject']}-{q['number']:03d}",
            "year": year, "level": "ตรี", "audience": meta["audience"], "subject": meta["subject"],
            "subject_title": meta["title"], "number": q["number"],
            "question": fix_text(q["question"]),
            "choices": {k: fix_text(v) for k, v in sorted(q["choices"].items())},
            "answer": ans if not any("ไม่ตรง" in r for r in reasons) else None,
            "answer_source": how, "page": q["page"],
            "needs_review": bool(reasons), "review_reasons": reasons,
        })
    items = split_sets(items)
    nums = [i["number"] for i in items if i["set"] == 1 and i["subject"] == meta["subject"]]
    gaps = [n for n in range(1, (max(nums) if nums else 0) + 1) if n not in nums]
    return items, gaps


def split_sets(items):
    """ถ้าเลขข้อเริ่มที่ 1 ซ้ำ (ไฟล์พิมพ์หลายชุด) -> ชุดที่เหมือนชุดแรกเกิน 90% ถือว่าซ้ำและตัดออก ชุดอื่นเก็บเป็น set 2,3.."""
    sets, cur = [], []
    for it in items:
        if it["number"] == 1 and cur:
            sets.append(cur)
            cur = []
        cur.append(it)
    if cur:
        sets.append(cur)
    out = []
    rx = re.compile(r"ศีล|วินัย|เบญจ")
    ratio = lambda st: sum(1 for x in st if rx.search(x["question"] + "".join(x["choices"].values()))) / max(len(st), 1)
    for n, st in enumerate(sets, 1):
        if n > 1 and st and items[0]["subject"] == "buddha" and ratio(st) >= 0.3 and ratio(sets[0]) < 0.1:
            # หัวข้อวิชาในไฟล์พิมพ์ผิด (วินัย ถูกหัวว่า พุทธประวัติ) -> จัดเป็นเบญจศีลเบญจธรรม ตามเนื้อหา
            for x in st:
                x["subject"] = "benja"
                x["id"] = x["id"].replace("-buddha-", "-benja-")
                x["notes"] = "หัวข้อวิชาในไฟล์ต้นฉบับระบุเป็นพุทธประวัติ แต่เนื้อหาเป็นเบญจศีลเบญจธรรม (วินัย) จัดตามเนื้อหา"
                x["set"] = 1
                x["review_reasons"] = [r for r in x["review_reasons"] if "เริ่มที่ 1" not in r]
                x["needs_review"] = bool(x["review_reasons"])
                out.append(x)
            continue
        if n > 1:
            first = {x["number"]: (x["question"], tuple(sorted(x["choices"].items()))) for x in sets[0]}
            same = sum(1 for x in st if first.get(x["number"]) == (x["question"], tuple(sorted(x["choices"].items()))))
            if same >= 0.9 * len(st):
                continue  # ชุดซ้ำ
        for x in st:
            x["set"] = n
            if n > 1:
                x["id"] += f"-s{n}"
                x["review_reasons"].append(f"ข้อสอบชุดที่ {n} ในวิชาเดียวกัน")
                x["needs_review"] = True
            x["review_reasons"] = [r for r in x["review_reasons"] if "เริ่มที่ 1" not in r]
            x["needs_review"] = bool(x["review_reasons"])
            out.append(x)
    return out


def essay_text(sec):
    return re.sub(r"\s+", " ", " ".join(t.strip() for _, t, _, _ in sec["spans"])).strip()


def main():
    years = [int(a) for a in sys.argv[1:]] or [y["year"] for y in INDEX["years"]]
    for y in INDEX["years"]:
        if y["year"] not in years:
            continue
        raw_dir = STORE / "raw" / str(y["year"])
        pdfs = []
        for f in y["files"]:
            if not f.get("has_dhammasuksa_tri") or not f.get("local"):
                continue
            p = STORE / f["local"]
            if p.suffix == ".pdf":
                pdfs.append((p, None, f))
            elif (raw_dir / "x").exists():
                for q in sorted((raw_dir / "x").glob("*.pdf")):
                    pdfs.append((q, next((a for key, a in AUDIENCES if key in q.name), None), f))
        report = {"year": y["year"], "sections": [], "sources": []}
        all_items, essays = [], []

        def run(pdf_list):
            for pdf, aud, f in pdf_list:
                rel = str(pdf).replace("\\", "/")
                report["sources"].append({"file": rel, "post_id": f["id"], "title": f["title"], "page_url": f["page_url"]})
                for (audience, subject), sec in parse_pdf(pdf, y["year"], aud).items():
                    if subject == "essay":
                        essays.append({"year": y["year"], "audience": audience, "text": essay_text(sec), "pages": sec["pages"], "source_file": rel})
                        continue
                    items, gaps = build_questions(sec, y["year"])
                    for it in items:
                        it["source_file"], it["source_url"] = rel, f["page_url"]
                    all_items.extend(items)
                    for subj in sorted({i["subject"] for i in items}):
                        sub = [i for i in items if i["subject"] == subj]
                        nums = {i["number"] for i in sub if i.get("set", 1) == 1}
                        report["sections"].append({
                            "audience": audience, "subject": subj, "title": sec["meta"]["title"][:60],
                            "image_only_pages": sec.get("image_pages", []), "questions": len(sub),
                            "answer_keys_found": len(sec["keys"]), "missing_numbers": [n for n in range(1, (max(nums) if nums else 0) + 1) if n not in nums],
                            "needs_review": sum(1 for i in sub if i["needs_review"]),
                            "pages": [min(i["page"] for i in sub), max(i["page"] for i in sub)],
                            "page_of": {str(i["number"]): i["page"] for i in sub if i.get("set", 1) == 1},
                        })

        # ไฟล์ที่ระบุชุดธรรมศึกษาชัดเจนก่อน; ไฟล์ "ปัญหาเฉลย พ.ศ.xxxx" (ไม่ระบุชุด) ใช้เมื่อปีนั้นยังไม่ได้ข้อสอบเลย
        primary = [t for t in pdfs if t[2]["kind"] != "unspecified"]
        fallback = [t for t in pdfs if t[2]["kind"] == "unspecified"]
        run(primary)
        if not all_items:
            run(fallback)
        # ข้อที่ถอดจากภาพด้วยมือ (หน้า PDF ไม่มีชั้นข้อความ) เก็บไว้ที่ store/years/<ปี>/manual.json -> รวมเข้ามา แต่ต้องตรวจซ้ำ
        out = STORE / "years" / str(y["year"])
        out.mkdir(parents=True, exist_ok=True)
        manual = out / "manual.json"
        if manual.exists():
            m = json.loads(manual.read_text(encoding="utf8"))
            have = {(i["audience"], i["subject"], i["number"]) for i in all_items}
            for it in m["items"]:
                aud = it.get("audience", "all")
                if (aud, it["subject"], it["number"]) in have:
                    continue
                all_items.append({
                    "id": f"{y['year']}-tri-{aud}-{it['subject']}-{it['number']:03d}", "year": y["year"], "level": "ตรี",
                    "audience": aud, "subject": it["subject"], "subject_title": "", "number": it["number"],
                    "question": it["question"], "choices": it["choices"], "answer": it["answer"], "answer_source": "manual-image",
                    "page": it["page"], "needs_review": True,
                    "review_reasons": ["ถอดความจากภาพหน้า PDF ด้วยสายตา (ไม่มีชั้นข้อความ) ควรตรวจซ้ำกับต้นฉบับ"],
                    "source_file": m["source_file"], "source_url": "", "set": 1,
                })
        # คำนวณสถิติรายวิชาใหม่จากข้อมูลสุดท้าย
        for sec_row in report["sections"]:
            sub = [i for i in all_items if i["audience"] == sec_row["audience"] and i["subject"] == sec_row["subject"]]
            nums = {i["number"] for i in sub if i.get("set", 1) == 1}
            sec_row["questions"] = len(sub)
            sec_row["missing_numbers"] = [n for n in range(1, (max(nums) if nums else 0) + 1) if n not in nums]
            sec_row["needs_review"] = sum(1 for i in sub if i["needs_review"])
        (out / "exam.json").write_text(json.dumps({"year": y["year"], "level": "ตรี", "report": report, "questions": all_items, "essays": essays}, ensure_ascii=False, indent=2), encoding="utf8")
        ok = sum(1 for i in all_items if not i["needs_review"])
        # สถานะรายปีใน index.json
        complete = bool(all_items) and all(not s_["missing_numbers"] for s_ in report["sections"])
        y["status"] = "missing" if not all_items else ("parsed" if complete and ok == len(all_items) else "needs_review" if complete else "partial")
        y["result"] = {"questions": len(all_items), "ok": ok, "needs_review": len(all_items) - ok, "sections": len(report["sections"]), "essays": len(essays)}
        if not all_items:
            y["note"] = "ไม่พบข้อสอบธรรมศึกษาชั้นตรีของปีนี้ในแหล่งทางการ (ไฟล์ปีนี้ที่พบเป็นของนักธรรม)"
        print(f"{y['year']}: sections={len(report['sections'])} questions={len(all_items)} ok={ok} review={len(all_items)-ok} essays={len(essays)}")
        for s_ in report["sections"]:
            print("   ", s_["audience"], s_["subject"], s_["questions"], "review", s_["needs_review"], "keys", s_["answer_keys_found"], "missing", s_["missing_numbers"])
    (STORE / "index.json").write_text(json.dumps(INDEX, ensure_ascii=False, indent=2), encoding="utf8")


if __name__ == "__main__":
    main()
