import { sb } from "./_supabase.js";

const ALLOW_ORIGIN = "https://manuel2554.github.io";
const ADMIN_TOKEN = process.env.ORDER_STATUS_ADMIN_TOKEN;

function cors(req, res) {
  res.setHeader("Access-Control-Allow-Origin", ALLOW_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(204).end();
  return false;
}

export default async function handler(req, res){
  const ended = cors(req, res);
  if(ended) return;

  if(req.method !== "POST") return res.status(405).json({ ok:false, error:"Method not allowed" });

  // auth
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if(!ADMIN_TOKEN || token !== ADMIN_TOKEN){
    return res.status(401).json({ ok:false, error:"Unauthorized" });
  }

  let body = req.body;
  if(typeof body === "string"){
    try{ body = JSON.parse(body); }catch{ body = {}; }
  }

  const code = String(body?.code || "").trim().toUpperCase();
  const status = String(body?.status || "").trim();

  const allowed = ["Recibido","Procesando","Enviado","Entregado","Cancelado"];
  if(!code) return res.status(400).json({ ok:false, error:"Missing code" });
  if(!allowed.includes(status)){
    return res.status(400).json({ ok:false, error:`Invalid status. Use: ${allowed.join(", ")}` });
  }

  const client = sb();
  const { data, error } = await client
    .from("orders")
    .update({ status, status_updated_at: new Date().toISOString() })
    .eq("code", code)
    .select("code,status,status_updated_at")
    .single();

  if(error) return res.status(500).json({ ok:false, error: error.message });

  return res.status(200).json({ ok:true, order: data });
}
