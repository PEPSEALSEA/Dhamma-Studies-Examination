import fs from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

// เสิร์ฟไฟล์ใน ../store (ชุดติว/สถิติที่มีลิขสิทธิ์) ผ่าน /local/* เฉพาะตอน dev
// ไม่ถูกรวมใน build จึงไม่ถูกเผยแพร่ขึ้น GitHub Pages
const ALLOW: Record<string, string> = {
  "study/tree.json": "study/secondary/tree.json",
  "study/flashcards.json": "study/secondary/flashcards.json",
  "study/question_map.json": "study/secondary/question_map.json",
  "study/essay_history.json": "study/secondary/essay_history.json",
  "analysis/overall.json": "analysis/overall.json",
  "index.json": "index.json",
};

function localStore(): Plugin {
  const root = path.resolve(__dirname, "../store");
  return {
    name: "local-store",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/local", (req, res, next) => {
        const key = decodeURIComponent((req.url ?? "").split("?")[0].replace(/^\//, ""));
        const rel = ALLOW[key] ?? (/^years\/\d{4}\/analysis\.json$/.test(key) ? key : null);
        const file = rel ? path.join(root, rel) : null;
        if (!file || !file.startsWith(root) || !fs.existsSync(file)) return next();
        res.setHeader("content-type", "application/json; charset=utf-8");
        res.setHeader("cache-control", "no-store");
        fs.createReadStream(file).pipe(res);
      });
    },
  };
}

const API = process.env.VITE_PROXY_TARGET ?? "https://dhamma-exam-api.githubpepsealsea.workers.dev";

export default defineConfig({
  base: "./", // ให้ทำงานได้ใต้ /<repo>/ บน GitHub Pages
  plugins: [react(), localStore()],
  server: {
    host: true, // เปิดให้เครื่องอื่นใน LAN เข้าได้ (เช่น มือถือ)
    // Worker ตรวจ Origin: ตอน dev ส่ง Origin ของ localhost ไปให้ผ่านการตรวจ
    proxy: { "/api": { target: API, changeOrigin: true, secure: true, headers: { Origin: "http://localhost:5173" } } },
  },
});
