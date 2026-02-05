import jwt from "jsonwebtoken";

const KEY = "brutalux_settings";
const DEFAULTS = {
  rate: 375.08,
  warranty: "5 años",
  logo: "https://i.postimg.cc/dVXHwFxJ/Whats-App-Image-2026-02-03-at_9_11_46_PM.jpg",
  heroBg: "https://images.unsplash.com/photo-1525609004556-c46c7d6cf023?auto=format&fit=crop&w=2200&q=80"
};

async function kvGet(key){
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  const res = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const data = await res.json();
  return data?.result ? JSON.parse(data.result) : null;
}

async function kvSet(key, value){
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  const res = await fetch(`${url}/set/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(JSON.stringify(value)),
  });
  if(!res.ok) throw new Error("KV set failed");
}

function verifyAdmin(req){
  const h = req.headers.authorization || "";
  const tok = h.startsWith("Bearer ") ? h.slice(7) : "";
  if(!tok) return null;
  try { return jwt.verify(tok, process.env.JWT_SECRET); }
  catch { return null; }
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    const saved = await kvGet(KEY);
    return res.json(saved || DEFAULTS);
  }

  if (req.method === "PUT") {
    const claims = verifyAdmin(req);
    if (!claims) return res.status(401).json({ error: "Unauthorized" });

    const next = req.body || {};
    const safe = {
      rate: Number(next.rate) || DEFAULTS.rate,
      warranty: String(next.warranty || DEFAULTS.warranty),
      logo: String(next.logo || DEFAULTS.logo),
      heroBg: String(next.heroBg || DEFAULTS.heroBg),
    };

    await kvSet(KEY, safe);
    return res.json({ ok: true, settings: safe });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
