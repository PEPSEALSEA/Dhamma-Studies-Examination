import { csvToObjects } from "./csv";
import { getAccessToken, readTab } from "./google";
import { sample } from "./sample";

interface Env {
  SHEET_ID: string;
  CACHE_SECONDS: string;
  ALLOWED_ORIGIN: string;
  GOOGLE_CLIENT_EMAIL?: string;
  GOOGLE_PRIVATE_KEY?: string; // secret — ตั้งด้วย `wrangler secret put` เท่านั้น ห้ามใส่ในโค้ด
}

const TABS = ["subjects", "questions", "study", "research"] as const;
type Tab = (typeof TABS)[number];

function corsOrigin(req: Request, env: Env): string {
  const origin = req.headers.get("origin") ?? "";
  const ok = origin === env.ALLOWED_ORIGIN || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  return ok ? origin : env.ALLOWED_ORIGIN;
}

const respond = (req: Request, env: Env, data: unknown, status = 200, cacheSeconds = 0) =>
  new Response(data === null ? null : JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": cacheSeconds ? `public, max-age=${cacheSeconds}` : "no-store",
      "access-control-allow-origin": corsOrigin(req, env),
      "access-control-allow-methods": "GET, OPTIONS",
      vary: "origin",
    },
  });

function mode(env: Env): "service-account" | "public-csv" | "sample" {
  if (env.SHEET_ID && env.GOOGLE_CLIENT_EMAIL && env.GOOGLE_PRIVATE_KEY) return "service-account";
  return env.SHEET_ID ? "public-csv" : "sample";
}

async function loadTab(env: Env, tab: Tab): Promise<Record<string, string>[]> {
  switch (mode(env)) {
    case "sample":
      return sample[tab] ?? [];
    case "service-account": {
      const token = await getAccessToken(env.GOOGLE_CLIENT_EMAIL!, env.GOOGLE_PRIVATE_KEY!);
      return readTab(env.SHEET_ID, tab, token);
    }
    default: {
      const url = `https://docs.google.com/spreadsheets/d/${env.SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Google Sheet "${tab}" HTTP ${res.status}`);
      return csvToObjects(await res.text());
    }
  }
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (req.method === "OPTIONS") return respond(req, env, null, 204);
    if (req.method !== "GET") return respond(req, env, { error: "method not allowed" }, 405);

    const url = new URL(req.url);
    const ttl = Number(env.CACHE_SECONDS) || 300;

    try {
      if (url.pathname === "/api/health") return respond(req, env, { ok: true, source: mode(env) });

      const m = url.pathname.match(/^\/api\/(\w+)$/);
      if (!m || !(TABS as readonly string[]).includes(m[1])) return respond(req, env, { error: "not found" }, 404);

      // cache ผลลัพธ์ที่ edge เพื่อลดการเรียก Sheets API (มี quota)
      const cacheKey = new Request(`${url.origin}${url.pathname}`);
      const cache = (caches as unknown as { default: Cache }).default;
      const hit = await cache.match(cacheKey);
      if (hit) {
        return new Response(await hit.text(), { headers: respond(req, env, null).headers });
      }

      const data = await loadTab(env, m[1] as Tab);
      const res = respond(req, env, data, 200, ttl);
      ctx.waitUntil(cache.put(cacheKey, new Response(JSON.stringify(data), { headers: { "cache-control": `public, max-age=${ttl}` } })));
      return res;
    } catch (e) {
      // ไม่ส่งรายละเอียดภายในออกไป (กันข้อมูลรั่ว) แค่บอกว่าล้มเหลว
      console.error((e as Error).message);
      return respond(req, env, { error: "upstream error" }, 502);
    }
  },
};
