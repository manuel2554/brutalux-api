import { sb } from "./_supabase.js";

const ALLOW_ORIGIN = "https://manuel2554.github.io";

// Telegram env (NO hardcode)
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TG_CHAT  = process.env.TELEGRAM_CHAT_ID;
const TG_THREAD_ID = process.env.TELEGRAM_THREAD_ID; // opcional

function cors(req, res) {
  res.setHeader("Access-Control-Allow-Origin", ALLOW_ORIGIN);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(204).end();
  return false;
}

function makeCode(){
  return "BLX-" + Math.random().toString(36).slice(2, 7).toUpperCase();
}

function money(n){
  const x = Number(n);
  return Number.isFinite(x) ? x.toFixed(2) : "0.00";
}

function esc(s){ return String(s ?? "").trim(); }

function buildTelegramMessage(order){
  const c = order.customer || {};
  const items = Array.isArray(order.items) ? order.items : [];
  const t = order.totals || {};

  const lines = items.map(it => {
    const qty = Number(it.qty) || 0;
    const price = Number(it.eur ?? it.usd ?? 0) || 0;
    const total = qty * price;
    return `• ${qty} x ${esc(it.name)} (${esc(it.id)}) = €${money(total)}`;
  }).join("\n");

  return (
`📦 NUEVO PEDIDO BRUTALUX
Código: ${order.code}

Cliente: ${esc(c.name) || "—"}
Vehículo: ${esc(c.car) || "—"}
Ciudad/Estado: ${esc(c.city) || "—"}
Nota: ${esc(c.note) || "—"}

Items:
${lines || "—"}

Subtotal EUR: €${money(t.subEur)}
Tasa: ${Number(t.rate) || "—"} Bs/EUR
Ref. Bs: ${Number.isFinite(Number(t.subBs)) ? "Bs " + Number(t.subBs).toFixed(2) : "—"}

Origen: ${esc(order.meta?.page) || "—"}`
  );
}

async function sendTelegram(text){
  if(!TG_TOKEN || !TG_CHAT){
    console.warn("Telegram env missing (set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID)");
    return;
  }

  const url = `https://api.telegram.org/bot${TG_TOKEN}/sendMessage`;

  const payload = {
    chat_id: TG_CHAT,
    text,
    disable_web_page_preview: true
  };

  if(TG_THREAD_ID) payload.message_thread_id = Number(TG_THREAD_ID);

  const r = await fetch(url, {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify(payload)
  });

  const out = await r.json().catch(()=> ({}));
  if(!r.ok || out?.ok === false){
    console.error("Telegram sendMessage failed:", r.status, out);
  }
}

export default async function handler(req, res){
  const ended = cors(req, res);
  if (ended) return;

  const client = sb();

  // POST: crear pedido
  if(req.method === "POST"){
    let body;
    try{
      body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    }catch{
      return res.status(400).json({ ok:false, error:"Invalid JSON" });
    }

    const items = Array.isArray(body?.items) ? body.items : [];
    if(!items.length) return res.status(400).json({ ok:false, error:"Empty order" });

    // code único (reintento simple)
    let code = makeCode();
    for(let i=0;i<5;i++){
      const { data } = await client.from("orders").select("code").eq("code", code).maybeSingle();
      if(!data) break;
      code = makeCode();
    }

    const order = {
      code,
      customer: body?.customer || {},
      items,
      totals: body?.totals || {},
      meta: body?.meta || {}
    };

    const { data, error } = await client
      .from("orders")
      .insert([order])
      .select("code, created_at")
      .single();

    if(error) return res.status(500).json({ ok:false, error: error.message });

    // ✅ enviar Telegram (no bloquea si falla)
    try{
      await sendTelegram(buildTelegramMessage(order));
    }catch(e){
      console.error("Telegram exception:", e);
    }

    return res.status(200).json({ ok:true, code: data.code, createdAt: data.created_at });
  }

  // GET: traer pedido por code
  if(req.method === "GET"){
    const code = String(req.query?.code || "").trim();
    if(!code) return res.status(400).json({ ok:false, error:"Missing code" });

    const { data, error } = await client
      .from("orders")
      .select("code, created_at, status, status_updated_at, customer, items, totals, meta")
      .eq("code", code)
      .single();

    if(error) return res.status(404).json({ ok:false, error:"Order not found" });

    return res.status(200).json({ ok:true, order: data });
  }

  return res.status(405).json({ ok:false, error:"Method not allowed" });
}
