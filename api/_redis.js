const { Redis } = require('@upstash/redis');

let cachedClient = null;

/**
 * Vercel deprecated "Vercel KV" for new projects (Dec 2024) — the replacement
 * is installing "Upstash" from the Vercel Marketplace (Storage -> Browse
 * Storage -> Marketplace Database Providers -> Upstash -> Redis). Depending
 * on how it was connected, the injected env vars can show up under a couple
 * of different names, so we check the common ones rather than hard-coding
 * just one.
 */
function getRedis() {
  if (cachedClient) return cachedClient;

  const url =
    process.env.KV_REST_API_URL ||
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.REDIS_REST_URL;

  const token =
    process.env.KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new Error(
      'Redis credentials not found. Connect an Upstash Redis database to this ' +
      'project in Vercel (Storage -> Browse Storage -> Marketplace Database ' +
      'Providers -> Upstash), then redeploy so the environment variables are injected.'
    );
  }

  cachedClient = new Redis({ url, token });
  return cachedClient;
}

module.exports = { getRedis };
