import { cached } from "./cache.js";

const BASE = "https://api.llama.fi";
const DAY = 86400;

async function getJson(url, timeoutMs = 8000) {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`DefiLlama ${res.status} on ${url}`);
  return res.json();
}

// Real chain-level TVL history for Mantle. Used for the ecosystem-wide
// total + 7d delta (genuine, not estimated).
export async function getChainTvlHistory() {
  const series = await getJson(`${BASE}/v2/historicalChainTvl/Mantle`);
  return series.map((point) => ({ date: point.date, tvl: point.tvl }));
}

// Real per-chain historical TVL for a single protocol. DefiLlama's
// top-level `change_7d` on /protocols is computed across a protocol's
// *entire* multichain footprint, which would misrepresent Mantle-specific
// health for e.g. Aave V3. Reading chainTvls.Mantle.tvl directly avoids
// that and gives an honest Mantle-only series.
export async function getProtocolMantleHistory(slug, { timeoutMs = 8000 } = {}) {
  // DefiLlama's /protocol/{slug} returns the FULL multichain payload (every
  // chain's history) even though we only want the Mantle slice, for a
  // large multichain protocol (e.g. Aave V3: ~28MB, 21 chains) that can
  // take upwards of a minute. `timeoutMs` lets callers that expect to hit
  // arbitrary/unknown-size protocols allow more time than the tracked,
  // pre-vetted (small, single-chain) protocol fetches need.
  const data = await getJson(`${BASE}/protocol/${slug}`, timeoutMs);
  const series = data?.chainTvls?.Mantle?.tvl ?? [];
  return {
    logo: data?.logo ?? null,
    history: series.map((point) => ({
      date: point.date,
      tvl: point.totalLiquidityUSD,
    })),
  };
}

// Find the closest data point to `targetUnix` in an ascending {date,tvl}[] series.
export function findClosest(series, targetUnix) {
  if (!series.length) return null;
  let best = series[0];
  let bestDiff = Math.abs(series[0].date - targetUnix);
  for (const point of series) {
    const diff = Math.abs(point.date - targetUnix);
    if (diff < bestDiff) {
      best = point;
      bestDiff = diff;
    }
  }
  return best;
}

export function daysAgo(n) {
  return Math.floor(Date.now() / 1000) - n * DAY;
}

// Real search across EVERY protocol DefiLlama tracks on Mantle, not just
// the 6 curated near-native ones in lib/protocols.js. Used by the chat
// agent's search_mantle_protocols tool so it can genuinely look something
// up instead of being limited to a fixed context dump. The full /protocols
// list is ~1-2MB, so it's cached for 10 minutes rather than re-fetched
// per search.
export async function searchMantleProtocols(query) {
  const { value: all } = await cached("defillama-protocols-list", 10 * 60_000, () => getJson(`${BASE}/protocols`, 20_000));
  const q = query.trim().toLowerCase();
  if (!q) return [];

  return all
    .filter((p) => p.chainTvls && "Mantle" in p.chainTvls && p.name.toLowerCase().includes(q))
    .map((p) => ({
      name: p.name,
      slug: p.slug,
      category: p.category,
      tvlMantleUsd: p.chainTvls.Mantle,
      chainCount: p.chains?.length ?? null,
      url: `https://defillama.com/protocol/${p.slug}`,
    }))
    .sort((a, b) => b.tvlMantleUsd - a.tvlMantleUsd)
    .slice(0, 5);
}

// Real, on-demand detail for a single protocol by slug, works for ANY
// Mantle protocol (found via searchMantleProtocols), not just the tracked
// 6. Fetches fresh from DefiLlama rather than the cached snapshot.
export async function getProtocolDetail(slug) {
  // 15s: generous for the tracked protocols (all ~1-5s in practice) without
  // letting a huge multichain protocol's payload hang the chat turn for a
  // minute-plus. See getProtocolMantleHistory for why the payload can be huge.
  const { logo, history } = await getProtocolMantleHistory(slug, { timeoutMs: 15_000 });
  if (!history.length) return null;

  const latest = history[history.length - 1];
  const point7dAgo = findClosest(history, daysAgo(7));
  const point30dAgo = findClosest(history, daysAgo(30));

  return {
    slug,
    logo,
    tvlUsd: latest.tvl,
    tvl7dAgoUsd: point7dAgo?.tvl ?? latest.tvl,
    tvl30dAgoUsd: point30dAgo?.tvl ?? latest.tvl,
    asOf: new Date(latest.date * 1000).toISOString(),
    url: `https://defillama.com/protocol/${slug}`,
  };
}
