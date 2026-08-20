const { getRedis } = require('./_redis');

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  try {
    const kv = getRedis();
    const { code, hostId } = req.body || {};
    if (!code || !hostId) { res.status(400).json({ error: 'code and hostId required' }); return; }
    const roomCode = String(code).toUpperCase();

    const meta = await kv.get(`room:${roomCode}:meta`);
    if (!meta) { res.status(404).json({ error: 'Room not found' }); return; }
    if (meta.hostId !== hostId) { res.status(403).json({ error: 'Only the host can start the round' }); return; }
    if (meta.status === 'playing') { res.status(200).json({ meta }); return; } // already started, idempotent

    meta.status = 'playing';
    meta.startedAt = Date.now();
    await kv.set(`room:${roomCode}:meta`, meta, { ex: 60 * 45 });

    res.status(200).json({ meta });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to start room' });
  }
};
