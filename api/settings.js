import jwt from "jsonwebtoken";
import { cors } from "./_cors.js";

const KEY = "brutalux_settings";

const DEFAULTS = {
  rate: 375.08,
  warranty: "5 años",
  logo: "https://i.postimg.cc/dVXHwFxJ/Whats-App-Image-2026-02-03-at-9-11-46-PM.jpg",
  heroBg: "https://images.unsplash.com/photo-1525609004556-c46c7d6cf023?auto=format&fit=crop&w=2200&q=80"
};

async function kvGet(key){
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if(!url || !token) throw new Error("Upstash env missing");

  const res = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store"
  });

  const data = await res.json();
  if (data?.result == null) return null;

  if (typeof data.result === "string") {
    try { return JSON.parse(data.result); }
    catch { return null; }
  }

  return data.result;
}
async function kvSet(key, value){
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if(!url || !token) throw new Error("Upstash env missing");

  const res = await fetch(`${url}/set/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(JSON.stringify(value))
  });

  if(!res.ok) throw new Error("KV set failed");
}

function verifyAdmin(req){
  const h = req.headers.authorization || "";
  const tok = h.startsWith("Bearer ") ? h.slice(7) : "";
  if(!tok) return null;
  try {
    return jwt.verify(tok, process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  // CORS + preflight
  if (cors(req, res)) return;

  // GET público: cualquiera puede leer settings
if (req.method === "GET") {
  let base = DEFAULTS;

  // 1) lee settings guardados (warranty/logo/heroBg)
  try{
    const saved = await kvGet(KEY);
    if(saved && typeof saved === "object") base = { ...DEFAULTS, ...saved };
  }catch(e){
    // si falla Upstash, seguimos con DEFAULTS
  }

  // 2) fuerza la tasa real del día desde /api/rate
  let liveRate = base.rate;
  try{
    const rr = await fetch("https://brutalux-api.vercel.app/api/rate", { cache:"no-store" });
    if(rr.ok){
      const rj = await rr.json();
      const r = Number(rj?.rate);
      if(isFinite(r) && r > 0) liveRate = r;
    }
  }catch(e){
    // si falla /api/rate, dejamos la tasa guardada/default
  }

  return res.status(200).json({ ...base, rate: liveRate });
}

  // PUT privado: solo admin con token
  if (req.method === "PUT") {
    const claims = verifyAdmin(req);
    if (!claims) return res.status(401).json({ error: "Unauthorized" });

    const next = req.body || {};
    const safe = {
      rate: Number(next.rate) || DEFAULTS.rate,
      warranty: String(next.warranty || DEFAULTS.warranty),
      logo: String(next.logo || DEFAULTS.logo),
      heroBg: String(next.heroBg || DEFAULTS.heroBg)
    };

    await kvSet(KEY, safe);
    return res.status(200).json({ ok: true, settings: safe });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
