import jwt from "jsonwebtoken";
import { cors } from "./_cors.js";

export default async function handler(req, res) {
  // CORS + preflight
  if (cors(req, res)) return;

  // Solo POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { user, pass } = req.body || {};

  if (!user || !pass) {
    return res.status(400).json({ error: "Missing credentials" });
  }

  // Valida contra variables de entorno en Vercel
  if (user !== process.env.ADMIN_USER || pass !== process.env.ADMIN_PASS) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  // Token JWT
  const token = jwt.sign(
    { role: "admin" },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  return res.status(200).json({ ok: true, token });
}
