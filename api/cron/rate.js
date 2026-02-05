import { sb } from "../_supabase.js";

const CRON_TOKEN = process.env.CRON_TOKEN;
const SOURCE_URL = "https://monitorvenezuela.com/tasa/bcv-euro/";

// ✅ Firma para verificar que sí se desplegó este código
const VERSION = "cron-v3-range-200-700";

// ✅ Rango realista para Bs/EUR (hoy ~447)
// Si en el futuro sube mucho, ajusta MAX_RATE.
const MIN_RATE = 200;
const MAX_RATE = 700;

function parseNumber(str){
  // Soporta: 447,22 | 447.22 | 1.234,56
  const m = str.match(/(\d{1,3}(?:\.\d{3})*(?:,\d{1,4})|\d{2,5}(?:\.\d{1,4})?)/);
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
    const r = await fetch(SOURCE_URL, { headers: { "User-Agent": "brutalux-api/1.0" } });
    if(!r.ok){
      return res.status(502).json({ ok:false, error:"Source fetch failed", status: r.status, version: VERSION });
    }

    const html = await r.text();
    const lower = html.toLowerCase();

    // Intento: buscar un número cerca de "euro" y también cerca de "bcv"
    const idxEuro = lower.indexOf("euro");
    const sliceEuro = idxEuro >= 0 ? html.slice(Math.max(0, idxEuro - 1500), idxEuro + 3000) : "";

    const idxBcv = lower.indexOf("bcv");
    const sliceBcv = idxBcv >= 0 ? html.slice(Math.max(0, idxBcv - 1500), idxBcv + 3000) : "";

    // Extraemos candidatos
    const candEuro = sliceEuro ? parseNumber(sliceEuro) : null;
    const candBcv  = sliceBcv ? parseNumber(sliceBcv) : null;
    const candAny  = parseNumber(html);

    // Elegimos el primer candidato válido en rango
    const candidates = [candEuro, candBcv, candAny].filter(x => Number.isFinite(x));
    const rate = candidates.find(x => x >= MIN_RATE && x <= MAX_RATE) ?? candidates[0] ?? null;

    if(!rate){
      return res.status(500).json({ ok:false, error:"Rate not found", version: VERSION });
    }

    // ✅ Anti-locura: si está fuera del rango, NO guardamos
    if(!(rate >= MIN_RATE && rate <= MAX_RATE)){
      return res.status(200).json({
        ok: false,
        error: "Rate out of range (NOT saved)",
        rate,
        expected: `${MIN_RATE}-${MAX_RATE}`,
        candidates,
        source: SOURCE_URL,
        version: VERSION
      });
    }

    // Guardar en Supabase
    const client = sb();
    const { error } = await client
      .from("settings")
      .upsert({
        key: "rate",
        value: { rate },
        updated_at: new Date().toISOString()
      });

    if(error){
      return res.status(500).json({ ok:false, error: error.message, version: VERSION });
    }

    return res.status(200).json({ ok:true, rate, candidates, source: SOURCE_URL, version: VERSION });
  }catch(e){
    return res.status(500).json({ ok:false, error: String(e?.message || e), version: VERSION });
  }
}
