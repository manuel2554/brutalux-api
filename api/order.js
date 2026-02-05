const ALLOW_ORIGIN = "https://manuel2554.github.io";
const ADMIN_TOKEN = process.env.ORDER_ADMIN_TOKEN;

const ORDERS = []; // demo en memoria

function cors(req, res) {
  res.setHeader("Access-Control-Allow-Origin", ALLOW_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(204).end();
  return false;
}

export default async function handler(req, res) {
  const ended = cors(req, res);
  if (ended) return;

  if (req.method === "POST") {
    let body;
    try {
      body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    } catch {
      return res.status(400).json({ ok: false, error: "Invalid JSON" });
    }

    const order = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      customer: body?.customer || {},
      items: Array.isArray(body?.items) ? body.items : [],
      totals: body?.totals || {},
      meta: body?.meta || {}
    };

    if (!order.items.length) {
      return res.status(400).json({ ok: false, error: "Empty order" });
    }

    ORDERS.push(order);
    return res.status(200).json({ ok: true, id: order.id });
  }

  if (req.method === "GET") {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

    if (!ADMIN_TOKEN || token !== ADMIN_TOKEN) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    return res.status(200).json({ ok: true, orders: ORDERS.slice(-50).reverse() });
  }

  return res.status(405).json({ ok: false, error: "Method not allowed" });
}
