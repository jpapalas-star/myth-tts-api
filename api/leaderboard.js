// Vercel KV-based leaderboard (uses Vercel KV / Upstash Redis)
// Falls back to in-memory if KV not available
// Scores expire after 60 days

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if(req.method==='OPTIONS'){ res.status(200).end(); return; }

  // Use Vercel KV if available, else simple JSON store via env
  const KV_URL = process.env.KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN;
  const USE_KV = !!(KV_URL && KV_TOKEN);

  const TWO_MONTHS = 60 * 24 * 60 * 60; // 60 days in seconds
  const TOP_N = 30;
  const SCORES_KEY = 'myth_scores';

  async function kvGet(key) {
    const r = await fetch(`${KV_URL}/get/${key}`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` }
    });
    const d = await r.json();
    return d.result ? JSON.parse(d.result) : null;
  }

  async function kvSet(key, value, exSeconds) {
    await fetch(`${KV_URL}/set/${key}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: JSON.stringify(value), ex: exSeconds })
    });
  }

  try {
    if(req.method === 'GET') {
      // Return top 15 scores
      if(!USE_KV){ res.status(200).json({ scores: [], error: 'KV not configured' }); return; }
      const scores = await kvGet(SCORES_KEY) || [];
      res.status(200).json({ scores: scores.slice(0, TOP_N) });

    } else if(req.method === 'POST') {
      const { name, score } = req.body;
      if(!name || typeof score !== 'number') { res.status(400).json({ error: 'Invalid' }); return; }
      if(!USE_KV){ res.status(200).json({ rank: null, scores: [] }); return; }

      const now = Date.now();
      let scores = await kvGet(SCORES_KEY) || [];

      // Remove expired entries (older than 60 days)
      scores = scores.filter(s => now - s.ts < TWO_MONTHS * 1000);

      // Check if this player already has a score — keep highest
      const existingIdx = scores.findIndex(s => s.name.toLowerCase() === name.toLowerCase());
      if(existingIdx >= 0) {
        if(score > scores[existingIdx].score) {
          scores[existingIdx] = { name, score, ts: now };
        }
      } else {
        scores.push({ name, score, ts: now });
      }

      // Sort descending
      scores.sort((a, b) => b.score - a.score);

      // Keep top 100 (to not grow unbounded)
      scores = scores.slice(0, 200);

      await kvSet(SCORES_KEY, scores, TWO_MONTHS);

      // Find rank
      const rank = scores.findIndex(s => s.name.toLowerCase() === name.toLowerCase()) + 1;

      res.status(200).json({ rank, scores: scores.slice(0, TOP_N) });
    }
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
}
