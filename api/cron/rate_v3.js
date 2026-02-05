import { sb } from "../_supabase.js";

const CRON_TOKEN = process.env.CRON_TOKEN;
const SOURCE_URL = "https://monitorvenezuela.com/tasa/bcv-euro/";

const VERSION = "rate_v3_range_200_700";
const MIN_RATE = 200;
const MAX_RATE = 700;

function parseNumber(str){
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

  const r = await fetch(SOURCE_URL, { headers: { "User-Agent":"brutalux-api/1.0" } });
  if(!r.ok) return res.status(502).json({ ok:false, error:"Source fetch failed", version: VERSION });

  const html = await r.text();
  const lower = html.toLowerCase();
  const idx = lower.indexOf("euro");
  const slice = idx >= 0 ? html.slice(Math.max(0, idx - 1500), idx + 3000) : html;

  const cand1 = parseNumber(slice);
  const cand2 = parseNumber(html);
  const candidates = [cand1, cand2].filter(x => Number.isFinite(x));

  const rateInRange = candidates.find(x => x >= MIN_RATE && x <= MAX_RATE);
  const rate = rateInRange ?? candidates[0] ?? null;

  if(!rate) return res.status(500).json({ ok:false, error:"Rate not found", version: VERSION });

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

  const client = sb();
  const { error } = await client.from("settings").upsert({
    key: "rate",
    value: { rate },
    updated_at: new Date().toISOString()
  });

  if(error) return res.status(500).json({ ok:false, error: error.message, version: VERSION });

  return res.status(200).json({ ok:true, rate, candidates, source: SOURCE_URL, version: VERSION });
}
