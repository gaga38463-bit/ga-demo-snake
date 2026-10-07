// Runs on Vercel, not in the browser. It is the only thing allowed to write
// scores, because it holds the Supabase secret key (set as an environment
// variable in Vercel, and in .env.local for local development).
const SUPABASE_URL = "https://skhdzmgxjiqawbrdjflm.supabase.co";
const MAX_SCORE = 400; // 20x20 board, one point per food

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Use POST" });
  }

  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) {
    console.error("SUPABASE_SECRET_KEY is not set");
    return res.status(500).json({ error: "Server is not configured" });
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const score = body.score;

  if (username.length < 1 || username.length > 16) {
    return res.status(400).json({ error: "Username must be 1 to 16 characters" });
  }
  if (!Number.isInteger(score) || score < 0 || score > MAX_SCORE) {
    return res.status(400).json({ error: `Score must be a whole number from 0 to ${MAX_SCORE}` });
  }

  const saved = await fetch(`${SUPABASE_URL}/rest/v1/scores`, {
    method: "POST",
    headers: {
      apikey: secretKey,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ username, score }),
  });

  if (!saved.ok) {
    console.error("Supabase insert failed", saved.status, await saved.text());
    return res.status(502).json({ error: "Could not save the score" });
  }
  return res.status(201).json({ ok: true });
};
