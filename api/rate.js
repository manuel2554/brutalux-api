import { sb } from "./_supabase.js";

const ALLOW_ORIGIN = "https://manuel2554.github.io";
const ADMIN_TOKEN = process.env.RATE_ADMIN_TOKEN;

function cors(req, res) {
  res.setHeader("Access-Control-Allow-Origin", ALLOW_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(204).end();
  return false;
}

export default async function handler(req, res) {
  const ended = cors(req, res);
  if (ended) return;

  const client = sb();

  if (req.method === "GET") {
    const { data, error } = await client
      .from("settings")
      .select("value, updated_at")
      .eq("key", "rate")
      .single();

    if (error) return res.status(500).json({ ok:false, error: error.message });

    const rate = Number(data?.value?.rate);
    return res.status(200).json({
      rate: Number.isFinite(rate) ? rate : null,
      updatedAt: data?.updated_at
    });
  }

  if (req.method === "POST") {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!ADMIN_TOKEN || token !== ADMIN_TOKEN) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    let body;
    try {
      body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    } catch {
      return res.status(400).json({ ok: false, error: "Invalid JSON" });
    }

    const r = Number(body?.rate);
    if (!Number.isFinite(r) || r <= 0) {
      return res.status(400).json({ ok: false, error: "Invalid rate" });
    }

    const { error } = await client
      .from("settings")
      .upsert({
        key: "rate",
        value: { rate: r },
        updated_at: new Date().toISOString()
      });

    if (error) return res.status(500).json({ ok:false, error: error.message });

    return res.status(200).json({ ok:true, rate: r });
  }

  return res.status(405).json({ ok: false, error: "Method not allowed" });
}
