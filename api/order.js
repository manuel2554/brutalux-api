import { sb } from "./_supabase.js";

const ALLOW_ORIGIN = "https://manuel2554.github.io";

function cors(req, res) {
  res.setHeader("Access-Control-Allow-Origin", ALLOW_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(204).end();
  return false;
}

function money(n){
  const x = Number(n);
  return Number.isFinite(x) ? x.toFixed(2) : "0.00";
}

async function sendTelegram(text){
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if(!token || !chatId) return;

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type":"application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true
    })
  });
}

export default async function handler(req, res) {
  const ended = cors(req, res);
  if (ended) return;

  if (req.method !== "POST") {
    return res.status(405).json({ ok:false, error:"Method not allowed" });
  }

  let body;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ ok:false, error:"Invalid JSON" });
  }

  const items = Array.isArray(body?.items) ? body.items : [];
  if (!items.length) return res.status(400).json({ ok:false, error:"Empty order" });

  const order = {
    customer: body?.customer || {},
    items,
    totals: body?.totals || {},
    meta: body?.meta || {}
  };

  const client = sb();
  const { data, error } = await client
    .from("orders")
    .insert([order])
    .select("id, created_at")
    .single();

  if (error) return res.status(500).json({ ok:false, error: error.message });

  // Telegram message
  const c = order.customer || {};
  const t = order.totals || {};
  const lines = items.map(it => `• ${it.qty} x ${it.name} (${it.id})`).join("\n");

  const msg =
`🧾 Pedido nuevo BRUTALUX
ID: ${data.id}
Fecha: ${data.created_at}

Cliente: ${c.name || "—"}
Vehículo: ${c.car || "—"}
Ciudad: ${c.city || "—"}
Nota: ${c.note || "—"}

Items:
${lines}

Subtotal EUR: €${money(t.subEur)}
Tasa Bs/EUR: ${t.rate ?? "—"}
Ref Bs: Bs ${t.subBs ?? "—"}

Link: ${order.meta?.page || "—"}
`;

  try{ await sendTelegram(msg); }catch(e){}

  return res.status(200).json({ ok:true, id: data.id });
}
