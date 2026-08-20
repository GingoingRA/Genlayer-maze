const { getRedis } = require('./_redis');

const ROUND_MS = 4 * 60 * 1000; // keep in sync with GAME_SECONDS in index.html

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

    // Joining is allowed both before AND after the host starts the round \u2014
    // a player who joins mid-round just gets dropped in with whatever time is
    // left (the frontend computes that from meta.startedAt). Only reject if
    // the round has already fully finished.
    if (meta.status === 'playing' && meta.startedAt && (Date.now() - meta.startedAt) >= ROUND_MS) {
      res.status(409).json({ error: "This room's round already ended" });
      return;
    }

    // HLEN + HSET on a per-player field is not a single atomic transaction, but each
    // player writes only their OWN hash field, so concurrent joins never overwrite
    // each other's entries the way a shared JSON blob would \u2014 this is the real
    // fix, not just a client-side retry loop.
    const count = await kv.hlen(`room:${roomCode}:players`);
    if (count >= (meta.maxPlayers || 300)) { res.status(409).json({ error: 'Room is full' }); return; }

    const id = 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
    await kv.hset(`room:${roomCode}:players`, { [id]: JSON.stringify({ id, name: cleanName, ts: Date.now() }) });
    await kv.expire(`room:${roomCode}:players`, 60 * 45);

    res.status(200).json({ id, meta });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to join room' });
  }
};
