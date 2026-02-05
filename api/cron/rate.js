import { sb } from "../_supabase.js";

const CRON_TOKEN = process.env.CRON_TOKEN;
const SOURCE_URL = "https://monitorvenezuela.com/tasa/bcv-euro/";
const ALLOW_ORIGIN = "https://manuel2554.github.io";

function cors(req, res){
  res.setHeader("Access-Control-Allow-Origin", ALLOW_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if(req.method === "OPTIONS") return res.status(204).end();
  return false;
}

function pickNumber(str){
  const m = str.match(/(\d{2,5}([.,]\d{1,4})?)/);
  if(!m) return null;
  const n = Number(m[1].replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export default async function handler(req, res){
  const ended = cors(req, res);
  if(ended) return;

  const token = req.query?.token || "";
  if(!CRON_TOKEN || token !== CRON_TOKEN){
    return res.status(401).json({ ok:false, error:"Unauthorized" });
  }

  try{
    const r = await fetch(SOURCE_URL, { headers: { "User-Agent": "brutalux-api/1.0" } });
    if(!r.ok) return res.status(502).json({ ok:false, error:"Source fetch failed" });

    const html = await r.text();

    const idx = html.toLowerCase().indexOf("euro");
    const slice = idx >= 0 ? html.slice(idx, idx + 2500) : html;

    const rate = pickNumber(slice) ?? pickNumber(html);
    if(!rate || rate <= 0) return res.status(500).json({ ok:false, error:"Rate not found" });

    const client = sb();
    const { error } = await client
      .from("settings")
      .upsert({
        key: "rate",
        value: { rate },
        updated_at: new Date().toISOString()
      });

    if(error) return res.status(500).json({ ok:false, error: error.message });

    return res.status(200).json({ ok:true, rate, source: SOURCE_URL });
  }catch(e){
    return res.status(500).json({ ok:false, error: String(e?.message || e) });
  }
}
