import { csvToObjects } from "./csv";
import { getAccessToken, readTab } from "./google";
import { sample } from "./sample";

interface RateLimiter { limit(opts: { key: string }): Promise<{ success: boolean }> }

interface Env {
  SHEET_ID: string;
  CACHE_SECONDS: string;
  ALLOWED_ORIGIN: string;
  GOOGLE_CLIENT_EMAIL?: string;
  GOOGLE_PRIVATE_KEY?: string; // secret — ตั้งด้วย `wrangler secret put` เท่านั้น ห้ามใส่ในโค้ด
  RATE_LIMITER?: RateLimiter; // ไม่บังคับ: ตั้งใน wrangler.jsonc (ratelimits)
}

const TABS = ["subjects", "questions", "study", "research"] as const;
type Tab = (typeof TABS)[number];
type Row = Record<string, string>;

const MAX_CHECK = 100; // จำนวนข้อสูงสุดต่อคำขอตรวจเฉลย
const MAX_BODY = 20_000; // ขนาด body สูงสุด (ตัวอักษร)

function originAllowed(origin: string, env: Env): boolean {
  return origin === env.ALLOWED_ORIGIN || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

function corsOrigin(req: Request, env: Env): string {
  const origin = req.headers.get("origin") ?? "";
  return originAllowed(origin, env) ? origin : env.ALLOWED_ORIGIN;
}

const respond = (req: Request, env: Env, data: unknown, status = 200, cacheSeconds = 0) =>
  new Response(data === null ? null : JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": cacheSeconds ? `public, max-age=${cacheSeconds}` : "no-store",
      "access-control-allow-origin": corsOrigin(req, env),
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type",
      "x-robots-tag": "noindex, nofollow",
      "x-content-type-options": "nosniff",
      vary: "origin",
    },
  });

function mode(env: Env): "service-account" | "public-csv" | "sample" {
  if (env.SHEET_ID && env.GOOGLE_CLIENT_EMAIL && env.GOOGLE_PRIVATE_KEY) return "service-account";
  return env.SHEET_ID ? "public-csv" : "sample";
}

async function loadTab(env: Env, tab: Tab): Promise<Row[]> {
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

// ข้อมูลเต็มของแท็บ (รวมเฉลย) แคชที่ edge เพื่อลดการเรียก Sheets API (มี quota)
// คีย์แคชเป็น URL ภายในที่ไม่ตรงกับเส้นทางสาธารณะ จึงไม่มีทางถูกเสิร์ฟดิบๆ
async function getTab(env: Env, ctx: ExecutionContext, tab: Tab): Promise<Row[]> {
  const ttl = Number(env.CACHE_SECONDS) || 300;
  const cache = (caches as unknown as { default: Cache }).default;
  const key = new Request(`https://cache.internal/tab/${tab}`);
  const hit = await cache.match(key);
  if (hit) return (await hit.json()) as Row[];
  const data = await loadTab(env, tab);
  ctx.waitUntil(cache.put(key, new Response(JSON.stringify(data), { headers: { "cache-control": `public, max-age=${ttl}` } })));
  return data;
}

// ข้อสอบที่ส่งให้หน้าเว็บ: ไม่มีเฉลย/คำอธิบาย — เฉลยส่งผ่าน POST /api/check เฉพาะข้อที่ผู้ใช้ตอบแล้ว
const publicQuestion = ({ answer: _a, explanation: _e, ...rest }: Row): Row => rest;

async function handleCheck(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const text = await req.text();
  if (text.length > MAX_BODY) return respond(req, env, { error: "too large" }, 413);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return respond(req, env, { error: "bad request" }, 400);
  }
  const answers = (body as { answers?: unknown } | null)?.answers;
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) return respond(req, env, { error: "bad request" }, 400);
  const entries = Object.entries(answers as Record<string, unknown>);
  if (entries.length === 0 || entries.length > MAX_CHECK) return respond(req, env, { error: "bad request" }, 400);

  const rows = await getTab(env, ctx, "questions");
  const byId = new Map(rows.map((r) => [r.id, r]));
  const out: Record<string, { ok: boolean; answer: string; explanation: string }> = {};
  for (const [id, pick] of entries) {
    const row = byId.get(id);
    // pick ว่าง = ไม่ได้ตอบ (ใช้ตอนสอบหมดเวลา) ยังเฉลยให้ แต่ถือว่าไม่ถูก
    if (!row || typeof pick !== "string" || !/^[a-d]?$/.test(pick)) return respond(req, env, { error: "bad request" }, 400);
    const answer = (row.answer ?? "").toLowerCase();
    out[id] = { ok: pick !== "" && pick === answer, answer, explanation: row.explanation ?? "" };
  }
  return respond(req, env, out);
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (req.method === "OPTIONS") return respond(req, env, null, 204);
    if (req.method !== "GET" && req.method !== "POST") return respond(req, env, { error: "method not allowed" }, 405);

    const url = new URL(req.url);

    try {
      if (url.pathname === "/api/health") return respond(req, env, { ok: true, source: mode(env) });

      const isCheck = url.pathname === "/api/check";
      const m = url.pathname.match(/^\/api\/(\w+)$/);
      const known = isCheck || (m && (TABS as readonly string[]).includes(m[1]));
      if (!known) return respond(req, env, { error: "not found" }, 404);
      if ((req.method === "POST") !== isCheck) return respond(req, env, { error: "method not allowed" }, 405);

      // ข้อมูลข้อสอบมีลิขสิทธิ์ของแม่กองธรรมสนามหลวง: เสิร์ฟให้เฉพาะหน้าเว็บของเราเท่านั้น
      // (เบราว์เซอร์ส่ง Origin ทุกครั้งที่เรียกข้ามโดเมน) — เป็นเพียงการยับยั้งการดึงแบบง่ายๆ
      // ไม่ใช่การยืนยันตัวตน; คนที่ปลอม header ได้ยังดึงได้
      if (!originAllowed(req.headers.get("origin") ?? "", env)) return respond(req, env, { error: "forbidden" }, 403);

      if (env.RATE_LIMITER) {
        const ip = req.headers.get("cf-connecting-ip") ?? "unknown";
        if (!(await env.RATE_LIMITER.limit({ key: ip })).success) return respond(req, env, { error: "too many requests" }, 429);
      }

      if (isCheck) return await handleCheck(req, env, ctx);

      const tab = m![1] as Tab;
      const data = await getTab(env, ctx, tab);
      const ttl = Number(env.CACHE_SECONDS) || 300;
      return respond(req, env, tab === "questions" ? data.map(publicQuestion) : data, 200, ttl);
    } catch (e) {
      // ไม่ส่งรายละเอียดภายในออกไป (กันข้อมูลรั่ว) แค่บอกว่าล้มเหลว
      console.error((e as Error).message);
      return respond(req, env, { error: "upstream error" }, 502);
    }
  },
};
