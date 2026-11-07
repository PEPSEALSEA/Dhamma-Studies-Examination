import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./", // ให้ทำงานได้ใต้ /<repo>/ บน GitHub Pages
  plugins: [react()],
  server: {
    // ส่ง /api ไปที่ wrangler dev (พอร์ต 8787)
    proxy: { "/api": "http://127.0.0.1:8787" },
  },
});
