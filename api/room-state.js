const { getRedis } = require('./_redis');

function parseHashValues(raw) {
  if (!raw) return [];
  return Object.values(raw).map(v => {
    if (typeof v === 'string') {
      try { return JSON.parse(v); } catch (err) { return null; }
    }
    return v;
  }).filter(Boolean);
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return; }
  try {
    const kv = getRedis();
    const code = String(req.query.code || '').toUpperCase();
    if (!code) { res.status(400).json({ error: 'code required' }); return; }

    const meta = await kv.get(`room:${code}:meta`);
    if (!meta) { res.status(404).json({ error: 'Room not found' }); return; }

    const [playersRaw, scoresRaw] = await Promise.all([
      kv.hgetall(`room:${code}:players`),
      kv.hgetall(`room:${code}:scores`),
    ]);

    res.status(200).json({
      meta,
      players: parseHashValues(playersRaw),
      scores: parseHashValues(scoresRaw),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to load room' });
  }
};
