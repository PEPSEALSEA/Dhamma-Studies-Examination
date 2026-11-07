import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { useActivity, useTheme } from "../lib/progress";

const TABS = [
  { to: "/", icon: "🏠", label: "หน้าแรก", end: true },
  { to: "/study", icon: "📖", label: "ติว" },
  { to: "/practice", icon: "📝", label: "ฝึกสอบ" },
  { to: "/stats", icon: "📊", label: "สถิติ" },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { theme, toggle } = useTheme();
  const { streak } = useActivity();
  return (
    <>
      <header className="topbar">
        <div className="topbar-in">
          <NavLink to="/" className="brand">
            <span className="brand-mark" aria-hidden>☸</span>
            <span>ธรรมศึกษาตรี</span>
          </NavLink>
          <nav className="navlinks" aria-label="เมนูหลัก">
            {TABS.map((t) => (
              <NavLink key={t.to} to={t.to} end={t.end}>{t.label}</NavLink>
            ))}
          </nav>
          <span className="pill" title="ฝึกต่อเนื่อง (วัน)">🔥 {streak}</span>
          <button className="icon-btn" onClick={toggle} aria-label="สลับธีมสว่าง/มืด">{theme === "dark" ? "☀️" : "🌙"}</button>
        </div>
      </header>
      <main className="page">
        {children}
        <footer className="site-foot">
          เว็บไซต์ฝึกสอบ<b>ไม่เป็นทางการ</b> จัดทำเพื่อการศึกษา ไม่ได้เกี่ยวข้องกับสำนักงานแม่กองธรรมสนามหลวง<br />
          ข้อสอบและเฉลยเป็นลิขสิทธิ์ของ{" "}
          <a href="https://www.gongtham.net" target="_blank" rel="noreferrer noopener">สำนักงานแม่กองธรรมสนามหลวง</a>{" "}
          — เฉลยหรือคำอธิบายอาจคลาดเคลื่อน โปรดตรวจกับข้อสอบและตำราทางการ ·{" "}
          <a href="https://github.com/PEPSEALSEA/Dhamma-Studies-Examination/issues" target="_blank" rel="noreferrer noopener">แจ้งข้อผิดพลาด/ขอให้ลบเนื้อหา</a>
        </footer>
      </main>
      <nav className="tabbar" aria-label="เมนูล่าง">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end}>
            <span aria-hidden>{t.icon}</span>
            {t.label}
          </NavLink>
        ))}
      </nav>
    </>
  );
}
