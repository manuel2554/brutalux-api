import { sb } from "../_supabase.js";

const CRON_TOKEN = process.env.CRON_TOKEN;
const SOURCE_URL = "https://monitorvenezuela.com/tasa/bcv-euro/";

// ✅ RANGO REALISTA Bs/EUR (ajústalo si sube mucho en el futuro)
const MIN_RATE = 100;
const MAX_RATE = 900;

function parseFirstNumber(str){
  // soporta 447,22 / 447.22 / 1.234,56
  const m = str.match(/(\d{1,3}(?:\.\d{3})*(?:,\d{1,4})|\d{2,5}(?:\.\d{1,4})?)/);
  if(!m) return null;
  const n = Number(m[1].replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export default async function handler(req, res){
  const token = req.query?.token || "";
  if(!CRON_TOKEN || token !== CRON_TOKEN){
    return res.status(401).json({ ok:false, error:"Unauthorized" });
  }

  try{
    const r = await fetch(SOURCE_URL, { headers: { "User-Agent": "brutalux-api/1.0" } });
    if(!r.ok) return res.status(502).json({ ok:false, error:"Source fetch failed" });

    const html = await r.text();
    const lower = html.toLowerCase();

    // Intento: buscar número cerca de "euro"
    const idx = lower.indexOf("euro");
    const slice = idx >= 0 ? html.slice(Math.max(0, idx - 1200), idx + 2500) : html;

    const rate = parseFirstNumber(slice) ?? parseFirstNumber(html);

    if(!rate) return res.status(500).json({ ok:false, error:"Rate not found" });

    // ✅ Anti-locura: no guardes números fuera del rango
    if(!(rate >= MIN_RATE && rate <= MAX_RATE)){
      return res.status(200).json({
        ok: false,
        error: "Rate out of range (NOT saved)",
        rate,
        expected: `${MIN_RATE}-${MAX_RATE}`,
        source: SOURCE_URL
      });
    }

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
