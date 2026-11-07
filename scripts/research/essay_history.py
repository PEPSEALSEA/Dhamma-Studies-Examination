#!/usr/bin/env python3
"""วิเคราะห์กระทู้ธรรมที่ออกสอบในวิชาเรียงความแก้กระทู้ธรรม ระดับมัธยม (ชั้นตรี) รายปี

อ่าน essays ใน store/years/<ปี>/exam.json (ข้อความข้อสอบเรียงความที่สกัดได้) และเทียบกับกระทู้ ๑๕ บทใน
store/study/secondary/src/essay/ch1.json  ->  store/study/secondary/essay_history.json
ปี ๒๕๕๙-๒๕๖๐ มีชุดเดียว (audience = all) จึงนับรวมด้วยแต่ระบุแยกไว้
"""
import json
import re
from pathlib import Path

STORE = Path("store")
OUT = STORE / "study" / "secondary"


def norm(s: str) -> str:
    return re.sub(r"[\s\.\,์]+", "", s)  # ตัดช่องว่าง/จุด/ตัวการันต์ เพื่อทนต่อ glyph เพี้ยนในบาลี


def sayings():
    ch = json.loads((OUT / "src" / "essay" / "ch1.json").read_text(encoding="utf8"))
    out = []
    for t in ch["topics"]:
        for st in t["subtopics"]:
            for p in st["points"]:
                m = re.match(r"^([๐-๙]+)\)\s*(.+?)\s*=\s*(.+?)\s*—\s*(.+)$", p)
                if m:
                    out.append({"no": m.group(1), "pali": m.group(2), "meaning": m.group(3), "source": m.group(4), "group": t["title"]})
    return out


def main():
    ss = sayings()
    hist = {"sayings": ss, "years": {}, "frequency": {}}
    for y in range(2559, 2569):
        f = STORE / "years" / str(y) / "exam.json"
        if not f.exists():
            continue
        d = json.loads(f.read_text(encoding="utf8"))
        rows = []
        for e in d.get("essays", []):
            if e["audience"] not in ("secondary", "all"):
                continue
            text = norm(e["text"])
            hits = [s["pali"] for s in ss if norm(s["pali"]) in text]
            rows.append({"audience": e["audience"], "matched_sayings": hits, "text_chars": len(e["text"]), "source_file": e.get("source_file")})
            for h in hits:
                hist["frequency"][h] = hist["frequency"].get(h, 0) + 1
        hist["years"][str(y)] = rows
    (OUT / "essay_history.json").write_text(json.dumps(hist, ensure_ascii=False, indent=2), encoding="utf8")
    print("sayings parsed:", len(ss))
    for y, rows in hist["years"].items():
        print(y, [(r["audience"], len(r["matched_sayings"])) for r in rows])
    print("most frequent:", sorted(hist["frequency"].items(), key=lambda x: -x[1])[:8])


if __name__ == "__main__":
    main()
