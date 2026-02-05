import { sb } from "../_supabase.js";

const CRON_TOKEN = process.env.CRON_TOKEN;
const SOURCE_URL = "https://monitorvenezuela.com/tasa/bcv-euro/";

// ✅ rango de seguridad (ajústalo si quieres)
const MIN_RATE = 10;     // nunca debería ser 0 o 1
const MAX_RATE = 5000;   // evita agarrar números locos

function parseRateFromText(txt){
  // Busca números tipo 442,59 / 442.59 / 1.234,56
  const m = txt.match(/(\d{1,3}(?:\.\d{3})*(?:,\d{1,4})|\d{2,5}(?:\.\d{1,4})?)/);
  if(!m) return null;
  const n = Number(m[1].replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function extractMonitorRate(html){
  const lower = html.toLowerCase();

  // 1) intentamos extraer cerca de “bcv” y “euro”
  const anchors = ["euro", "bcv"];
  let best = null;

  for(const a of anchors){
    const idx = lower.indexOf(a);
    if(idx >= 0){
      const slice = html.slice(Math.max(0, idx - 1200), idx + 2000);
      const r = parseRateFromText(slice);
      if(r) { best = r; break; }
    }
  }

  // 2) fallback: primer número razonable del documento
  if(!best){
    const r = parseRateFromText(html);
    if(r) best = r;
  }

  return best;
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
    const rate = extractMonitorRate(html);

    if(!rate) return res.status(500).json({ ok:false, error:"Rate not found" });

    // ✅ Validación anti-locura
    if(!(rate >= MIN_RATE && rate <= MAX_RATE)){
      return res.status(200).json({
        ok: false,
        error: "Rate out of range (not saved)",
        rate,
        min: MIN_RATE,
        max: MAX_RATE
      });
    }

    const client = sb();

    // guardar tasa buena
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
