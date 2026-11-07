#!/usr/bin/env python3
"""สกัดข้อความหนังสือธรรมศึกษา ชั้นตรี ระดับมัธยมศึกษา (PDF ทางการ) เป็นข้อความรายหน้า

ผลลัพธ์ (เฉพาะในเครื่อง): store/study/secondary/book_pages.json และ book.txt
แก้ glyph ของฟอนต์ THK2DJuly8: สระอำ ถูกเข้ารหัสเป็น "Ĝา"/"ŀา" ส่วนตัว "ำ" ที่เห็นตรง ๆ คือ "า" ที่แสดงผลเพี้ยน
"""
import json
import re
import warnings
from pathlib import Path

warnings.filterwarnings("ignore")
import pymupdf  # noqa: E402

SRC = Path("store/raw/curriculum/book-tri-secondary-2564.pdf")
OUT = Path("store/study/secondary")
OUT.mkdir(parents=True, exist_ok=True)
MARKS = "ัิีึืฺุู็่้๊๋์ํ๎"


def fix(s: str) -> str:
    s = s.replace("ŀำ", "\x00").replace("Ĝำ", "\x00")   # สระอำที่ถูกต้อง
    s = s.replace("ำ", "า")                               # "ำ" ตรง ๆ = "า" เพี้ยน
    s = re.sub("[Ĝŀ]า", "ำ", s)
    s = s.replace("Ĝ", "ํ").replace("ŀ", "")              # นิคหิต (บาลี) / ตัวคั่น
    s = s.replace("\x00", "ำ")
    s = re.sub(r"[✓]", "", s)
    return re.sub(f"([{MARKS}])\\1+", r"\1", s)


def main():
    doc = pymupdf.open(SRC)
    pages = []
    for i in range(doc.page_count):
        lines = []
        for b in doc[i].get_text("dict")["blocks"]:
            for ln in b.get("lines", []):
                t = "".join(fix(sp["text"]) for sp in ln["spans"]).strip()
                if not t:
                    continue
                bold = any("bold" in sp["font"].lower() for sp in ln["spans"] if sp["text"].strip())
                lines.append(("## " if bold and len(t) < 70 else "") + t)
        text = "\n".join(l for l in lines if not l.startswith("ธรรมศึกษา ชั้นตรี ระดับมัธยมศึกษา"))
        pages.append({"pdf_page": i + 1, "text": text})
    (OUT / "book_pages.json").write_text(json.dumps(pages, ensure_ascii=False, indent=1), encoding="utf8")
    (OUT / "book.txt").write_text("\n".join(f"\n=== PDF p{p['pdf_page']} ===\n{p['text']}" for p in pages), encoding="utf8")
    print("pages", len(pages), "chars", sum(len(p["text"]) for p in pages))


if __name__ == "__main__":
    main()
