import { Link } from "react-router-dom";

export default function Home() {
  return (
    <>
      <h1>ฝึกสอบธรรมศึกษาชั้นตรี</h1>
      <p className="muted">ติวเนื้อหา ทำ Mock test ย้อนหลังรายปี และดูข้อมูลวิเคราะห์ข้อสอบ</p>
      <div className="grid">
        <Link className="card" to="/study"><h3>ติวเนื้อหา</h3><p>สรุปรายวิชาและหมวดธรรม</p></Link>
        <Link className="card" to="/mock"><h3>Mock test รายปี</h3><p>จับเวลา ตรวจคะแนน ดูเฉลย</p></Link>
        <Link className="card" to="/research"><h3>Research รายปี</h3><p>แนวข้อสอบและข้อมูลอ้างอิง</p></Link>
      </div>
    </>
  );
}
