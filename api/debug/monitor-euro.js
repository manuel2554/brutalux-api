const CRON_TOKEN = process.env.CRON_TOKEN;
const SOURCE_URL = "https://monitorvenezuela.com/tasa/bcv-euro/";

export default async function handler(req, res){
  const token = req.query?.token || "";
  if(!CRON_TOKEN || token !== CRON_TOKEN){
    return res.status(401).send("unauthorized");
  }

  const r = await fetch(SOURCE_URL, { headers: { "User-Agent": "brutalux-api/1.0" } });
  const html = await r.text();

  // devolvemos solo un pedazo para no hacer enorme la respuesta
  const lower = html.toLowerCase();
  const idx = lower.indexOf("447"); // cambia 447 por "euro" si quieres
  const start = Math.max(0, idx - 1500);
  const end = Math.min(html.length, idx + 1500);

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.status(200).send(html.slice(start, end));
}
