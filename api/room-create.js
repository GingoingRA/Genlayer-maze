const { getRedis } = require('./_redis');

function genCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L, avoids ambiguity
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  try {
    const kv = getRedis();
    const { hostName } = req.body || {};
    if (!hostName || typeof hostName !== 'string') { res.status(400).json({ error: 'hostName required' }); return; }
    const cleanName = hostName.slice(0, 18);

    let code = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = genCode();
      const exists = await kv.exists(`room:${candidate}:meta`);
      if (!exists) { code = candidate; break; }
    }
    if (!code) { res.status(500).json({ error: 'Could not allocate a room code, try again' }); return; }

    const hostId = 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
    const seed = Math.floor(Math.random() * 2147483647);
    const meta = {
      code, status: 'waiting', hostName: cleanName, hostId,
      maxPlayers: 300, mazeSeed: seed, createdAt: Date.now()
    };

    await kv.set(`room:${code}:meta`, meta, { ex: 60 * 60 * 6 }); // auto-expire after 6h
    await kv.hset(`room:${code}:players`, { [hostId]: JSON.stringify({ id: hostId, name: cleanName, ts: Date.now() }) });
    await kv.expire(`room:${code}:players`, 60 * 60 * 6);

    res.status(200).json({ code, hostId, meta });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create room' });
  }
};
