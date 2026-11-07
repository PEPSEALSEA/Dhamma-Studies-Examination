import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Study from "./pages/Study";
import Flashcards from "./pages/Flashcards";
import Practice from "./pages/Practice";
import Quiz from "./pages/Quiz";
import Stats from "./pages/Stats";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/study" element={<Study />} />
        <Route path="/study/cards/:subject" element={<Flashcards />} />
        <Route path="/practice" element={<Practice />} />
        <Route path="/practice/:year/:audience" element={<Quiz />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="*" element={<p>ไม่พบหน้านี้</p>} />
      </Routes>
    </Layout>
  );
}
