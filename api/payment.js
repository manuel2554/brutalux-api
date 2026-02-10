import { sb } from "./_supabase.js";

const ALLOW_ORIGIN = "https://manuel2554.github.io";
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TG_CHAT  = process.env.TELEGRAM_CHAT_ID;
const TG_THREAD_ID = process.env.TELEGRAM_THREAD_ID; // opcional

function cors(req, res) {
  res.setHeader("Access-Control-Allow-Origin", ALLOW_ORIGIN);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(204).end();
  return false;
}

async function sendTelegram(text){
  if(!TG_TOKEN || !TG_CHAT) return;

  const url = `https://api.telegram.org/bot${TG_TOKEN}/sendMessage`;
  const payload = {
    chat_id: TG_CHAT,
    text,
    disable_web_page_preview: true
  };
  if(TG_THREAD_ID) payload.message_thread_id = Number(TG_THREAD_ID);

  await fetch(url, {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify(payload)
  }).catch(()=>{});
}

export default async function handler(req, res){
  const ended = cors(req, res);
  if(ended) return;

  if(req.method !== "POST"){
    return res.status(405).json({ ok:false, error:"Method not allowed" });
  }

  let body;
  try{
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  }catch{
    return res.status(400).json({ ok:false, error:"Invalid JSON" });
  }

  const orderCode = String(body?.orderCode || "").trim().toUpperCase();
  const reference = String(body?.reference || "").trim();
  const amount    = Number(body?.amount);
  const currency  = String(body?.currency || "Bs").trim();
  const senderBank  = String(body?.senderBank || "").trim();
  const senderPhone = String(body?.senderPhone || "").trim();
  const paidAt      = body?.paidAt ? new Date(body.paidAt).toISOString() : null;

  if(!orderCode) return res.status(400).json({ ok:false, error:"Missing orderCode" });
  if(!reference) return res.status(400).json({ ok:false, error:"Missing reference" });
  if(!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ ok:false, error:"Invalid amount" });

  const client = sb();

  // 1) Verifica que la orden exista
  const { data: ord, error: ordErr } = await client
    .from("orders")
    .select("code, status, customer, totals, created_at")
    .eq("code", orderCode)
    .single();

  if(ordErr) return res.status(404).json({ ok:false, error:"Order not found" });

  // 2) Guarda el reporte de pago
  const paymentRow = {
    order_code: orderCode,
    method: "pagomovil",
    amount,
    currency,
    reference,
    sender_bank: senderBank || null,
    sender_phone: senderPhone || null,
    paid_at: paidAt,
    status: "Reportado"
  };

  const { data: pay, error: payErr } = await client
    .from("payments")
    .insert([paymentRow])
    .select("id, order_code, status, created_at")
    .single();

  if(payErr) return res.status(500).json({ ok:false, error: payErr.message });

  // 3) Cambia estatus del pedido a “Pago reportado”
  await client
    .from("orders")
    .update({ status: "Pago reportado", status_updated_at: new Date().toISOString() })
    .eq("code", orderCode);

  // 4) Notifica a Telegram
  const c = ord?.customer || {};
  const msg =
`💳 PAGO MÓVIL REPORTADO
Código: ${orderCode}
Cliente: ${c.name || "—"}
Ciudad: ${c.city || "—"}

Monto: ${currency} ${amount}
Referencia: ${reference}
Banco emisor: ${senderBank || "—"}
Teléfono emisor: ${senderPhone || "—"}

Estatus pedido: Pago reportado`;

  await sendTelegram(msg);

  return res.status(200).json({ ok:true, payment: pay });
}
