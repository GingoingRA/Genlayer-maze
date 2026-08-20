const { getRedis } = require('./_redis');

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  try {
    const kv = getRedis();
    const { code, id, name, score, elapsed } = req.body || {};
    if (!code || !id) { res.status(400).json({ error: 'code and id required' }); return; }
    const roomCode = String(code).toUpperCase();

    // Each player writes only their own hash field (keyed by their player id),
    // so simultaneous score submissions from many players \u2014 which cluster
    // tightly since everyone's timer ends around the same wall-clock moment \u2014
    // can never overwrite each other, unlike a single shared JSON array would.
    await kv.hset(`room:${roomCode}:scores`, {
      [id]: JSON.stringify({ id, name, score, elapsed, ts: Date.now() })
    });
    await kv.expire(`room:${roomCode}:scores`, 60 * 45);

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to submit score' });
  }
};
