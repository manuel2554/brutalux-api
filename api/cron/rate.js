import { sb } from "../_supabase.js";

const CRON_TOKEN = process.env.CRON_TOKEN;

// fuente
const SOURCE_URL = "https://monitorvenezuela.com/tasa/bcv-euro/";

function pickFirstNumber(str){
  // busca números tipo 442,59 o 442.59
  const m = str.match(/(\d{2,5}([.,]\d{1,4})?)/);
  if(!m) return null;
  const n = Number(m[1].replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export default async function handler(req, res){
  // seguridad
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if(!CRON_TOKEN || token !== CRON_TOKEN){
    return res.status(401).json({ ok:false, error:"Unauthorized" });
  }

  try{
    // bajar HTML
    const r = await fetch(SOURCE_URL, {
      headers: { "User-Agent": "brutalux-api/1.0" }
    });
    if(!r.ok) return res.status(502).json({ ok:false, error:"Source fetch failed" });

    const html = await r.text();

    // Intento 1: buscar cerca de "Euro" y "BCV"
    const idx = html.toLowerCase().indexOf("euro");
    const slice = idx >= 0 ? html.slice(idx, idx + 2000) : html;

    const rate = pickFirstNumber(slice) ?? pickFirstNumber(html);
    if(!rate || rate <= 0) return res.status(500).json({ ok:false, error:"Rate not found" });

    // guardar en Supabase
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
