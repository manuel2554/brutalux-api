import { sb } from "./_supabase.js";

const ALLOW_ORIGIN = "https://manuel2554.github.io";

function cors(req, res) {
  res.setHeader("Access-Control-Allow-Origin", ALLOW_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  return false;
}

function makeCode(){
  return "BLX-" + Math.random().toString(36).slice(2, 7).toUpperCase();
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

    return res.status(200).json({ ok:true, code: data.code, createdAt: data.created_at });
  }

  // GET: traer pedido por code
  if(req.method === "GET"){
    const code = String(req.query?.code || "").trim();
    if(!code) return res.status(400).json({ ok:false, error:"Missing code" });

    const { data, error } = await client
      .from("orders")
      .select("code, created_at, customer, items, totals, meta")
      .eq("code", code)
      .single();

    if(error) return res.status(404).json({ ok:false, error:"Order not found" });

    return res.status(200).json({ ok:true, order: data });
  }

  return res.status(405).json({ ok:false, error:"Method not allowed" });
}
