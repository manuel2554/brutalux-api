import { sb } from "../_supabase.js";

const CRON_TOKEN = process.env.CRON_TOKEN;
const SOURCE_URL = "https://monitorvenezuela.com/tasa/bcv-euro/";

const VERSION = "cron-v4-exact-label";

// rango de seguridad (por si acaso)
const MIN_RATE = 200;
const MAX_RATE = 700;

function extractRate(html){
  // Busca exactamente: Tasa Euro BCV: 447,22 Bs
  const re = /Tasa\s+Euro\s+BCV:\s*([0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]{1,4})?)\s*Bs/;
  const m = html.match(re);
  if(!m) return null;
  const n = Number(m[1].replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export default async function handler(req, res){
  const token = req.query?.token || "";
  if(!CRON_TOKEN || token !== CRON_TOKEN){
    return res.status(401).json({ ok:false, error:"Unauthorized", version: VERSION });
  }

  try{
    const r = await fetch(SOURCE_URL, { headers: { "User-Agent":"brutalux-api/1.0" } });
    if(!r.ok) return res.status(502).json({ ok:false, error:"Source fetch failed", status:r.status, version: VERSION });

    const html = await r.text();
    const rate = extractRate(html);

    if(!rate){
      return res.status(200).json({
        ok:false,
        error:"Rate not found with exact label (NOT saved)",
        version: VERSION
      });
    }

    if(!(rate >= MIN_RATE && rate <= MAX_RATE)){
      return res.status(200).json({
        ok:false,
        error:"Rate out of range (NOT saved)",
        rate,
        expected: `${MIN_RATE}-${MAX_RATE}`,
        version: VERSION
      });
    }

    const client = sb();
    const { error } = await client
      .from("settings")
      .upsert({
        key: "rate",
        value: { rate },
        updated_at: new Date().toISOString()
      });

    if(error) return res.status(500).json({ ok:false, error: error.message, version: VERSION });

    return res.status(200).json({ ok:true, rate, source: SOURCE_URL, version: VERSION });
  }catch(e){
    return res.status(500).json({ ok:false, error: String(e?.message || e), version: VERSION });
  }
}
