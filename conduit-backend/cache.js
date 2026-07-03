// Tiny in-memory TTL cache. Good enough for a single long-lived `next dev`
// / `next start` node process, keeps the dashboard snappy on repeat loads
// without hammering DefiLlama/RPC on every request. Not shared across
// serverless instances; that's an acceptable tradeoff for this deliverable.

const store = new Map();

export async function cached(key, ttlMs, fn) {
  const hit = store.get(key);
  const now = Date.now();
  if (hit && now - hit.at < ttlMs) {
    return { value: hit.value, cachedAt: hit.at };
  }
  const value = await fn();
  store.set(key, { value, at: now });
  return { value, cachedAt: now };
}

export function getStale(key) {
  const hit = store.get(key);
  return hit ? { value: hit.value, cachedAt: hit.at } : null;
}
