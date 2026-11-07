import { NavLink, Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import Study from "./pages/Study";
import MockList from "./pages/MockList";
import MockTest from "./pages/MockTest";
import Research from "./pages/Research";

export default function App() {
  return (
    <>
      <header className="nav">
        <NavLink to="/" className="brand">ธรรมศึกษาตรี</NavLink>
        <NavLink to="/study">ติว</NavLink>
        <NavLink to="/mock">Mock test</NavLink>
        <NavLink to="/research">Research</NavLink>
      </header>
      <main className="container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/study" element={<Study />} />
          <Route path="/mock" element={<MockList />} />
          <Route path="/mock/:year" element={<MockTest />} />
          <Route path="/research" element={<Research />} />
        </Routes>
      </main>
    </>
  );
}
