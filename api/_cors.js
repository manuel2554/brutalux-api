export function cors(req, res) {
  // SOLO permite tu GitHub Pages
  res.setHeader("Access-Control-Allow-Origin", "https://manuel2554.github.io");
  res.setHeader("Vary", "Origin");

  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // Respuesta al preflight (OPTIONS)
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true;
  }
  return false;
}
