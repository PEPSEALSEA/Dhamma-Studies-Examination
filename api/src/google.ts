// เข้าถึง Google Sheets API ด้วย service account (ไม่ต้องเปิดชีตเป็นสาธารณะ)
// ใช้ WebCrypto เซ็น JWT (RS256) แล้วแลกเป็น access token — ไม่มี dependency เพิ่ม

const SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

let cached: { token: string; exp: number } | null = null;

const b64url = (data: ArrayBuffer | string) => {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

async function importKey(pem: string): Promise<CryptoKey> {
  // secret อาจถูกเก็บโดยมี \n เป็นข้อความตรงๆ จึง normalize ก่อน
  const body = pem
    .replace(/\\n/g, "\n")
    .replace(/-----(BEGIN|END) PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
}

export async function getAccessToken(email: string, privateKey: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cached && cached.exp - 60 > now) return cached.token;

  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({ iss: email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 }));
  const signing = `${header}.${claim}`;
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", await importKey(privateKey), new TextEncoder().encode(signing));

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${signing}.${b64url(sig)}`,
    }),
  });
  if (!res.ok) throw new Error(`Google token error HTTP ${res.status}`);
  const j = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: j.access_token, exp: now + j.expires_in };
  return j.access_token;
}

// อ่านแท็บเป็น array ของ object (แถวแรก = ชื่อคอลัมน์)
export async function readTab(sheetId: string, tab: string, token: string): Promise<Record<string, string>[]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(tab)}?majorDimension=ROWS`;
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Sheets API "${tab}" HTTP ${res.status}`);
  const { values = [] } = (await res.json()) as { values?: string[][] };
  const [header, ...rows] = values;
  if (!header) return [];
  const keys = header.map((h) => h.trim());
  return rows
    .filter((r) => r.some((c) => String(c).trim() !== ""))
    .map((r) => Object.fromEntries(keys.map((k, i) => [k, String(r[i] ?? "").trim()])));
}
