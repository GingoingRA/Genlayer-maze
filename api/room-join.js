const { getRedis } = require('./_redis');

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  try {
    const kv = getRedis();
    const { code, name } = req.body || {};
    if (!code || !name) { res.status(400).json({ error: 'code and name required' }); return; }
    const roomCode = String(code).toUpperCase();
    const cleanName = String(name).slice(0, 18);

    const meta = await kv.get(`room:${roomCode}:meta`);
    if (!meta) { res.status(404).json({ error: 'Room not found' }); return; }
    if (meta.status !== 'waiting') { res.status(409).json({ error: 'This room already started' }); return; }

    // HLEN + HSET on a per-player field is not a single atomic transaction, but each
    // player writes only their OWN hash field, so concurrent joins never overwrite
    // each other's entries the way a shared JSON blob would \u2014 this is the real
    // fix, not just a client-side retry loop.
    const count = await kv.hlen(`room:${roomCode}:players`);
    if (count >= (meta.maxPlayers || 300)) { res.status(409).json({ error: 'Room is full' }); return; }

    const id = 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
    await kv.hset(`room:${roomCode}:players`, { [id]: JSON.stringify({ id, name: cleanName, ts: Date.now() }) });

    res.status(200).json({ id, meta });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to join room' });
  }
};
