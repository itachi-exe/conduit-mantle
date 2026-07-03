import { cached, getStale } from "./cache.js";
import { getChainTvlHistory, getProtocolMantleHistory, findClosest, daysAgo } from "./defillama.js";
import { getChainHeartbeat } from "./mantle.js";
import { TRACKED_PROTOCOLS } from "./protocols.js";
import { FALLBACK_SNAPSHOT } from "./fallbackData.js";

const SNAPSHOT_TTL_MS = 60_000;
const CACHE_KEY = "snapshot";

async function buildLiveSnapshot() {
  const [chainTvlHistory, heartbeat, protocolHistories] = await Promise.all([
    getChainTvlHistory(),
    getChainHeartbeat(),
    Promise.all(
      TRACKED_PROTOCOLS.map(async (protocol) => {
        const { logo, history } = await getProtocolMantleHistory(protocol.slug);
        return { ...protocol, logo: logo ?? protocol.logo, history };
      })
    ),
  ]);

  const latestChain = chainTvlHistory[chainTvlHistory.length - 1];
  const chain7dAgo = findClosest(chainTvlHistory, daysAgo(7));

  const protocols = protocolHistories.map((protocol) => {
    const { history, ...meta } = protocol;
    const latest = history[history.length - 1];
    const point7dAgo = findClosest(history, daysAgo(7));
    const point30dAgo = findClosest(history, daysAgo(30));
    const trend90d = history.filter((p) => p.date >= daysAgo(90));

    return {
      ...meta,
      tvl: latest?.tvl ?? 0,
      tvl7dAgo: point7dAgo?.tvl ?? latest?.tvl ?? 0,
      tvl30dAgo: point30dAgo?.tvl ?? latest?.tvl ?? 0,
      trend: trend90d.map((p) => ({ date: p.date, tvl: p.tvl })),
    };
  });

  return {
    source: "live",
    generatedAt: Date.now(),
    ecosystem: {
      totalTvl: latestChain?.tvl ?? 0,
      tvl7dAgo: chain7dAgo?.tvl ?? latestChain?.tvl ?? 0,
    },
    protocols,
    heartbeat,
  };
}

function buildFallbackSnapshot(err) {
  const protocols = FALLBACK_SNAPSHOT.protocols.map((fallback) => {
    const meta = TRACKED_PROTOCOLS.find((p) => p.slug === fallback.slug);
    const now = Math.floor(Date.now() / 1000);
    // Synthetic 2-point trend so the chart renders something, clearly
    // sourced from fallback data, not fabricated live history.
    const trend = [
      { date: now - 7 * 86400, tvl: fallback.tvl7dAgo },
      { date: now, tvl: fallback.tvl },
    ];
    return { ...meta, ...fallback, tvl30dAgo: fallback.tvl7dAgo, trend };
  });

  return {
    ...FALLBACK_SNAPSHOT,
    protocols,
    generatedAt: Date.now(),
    fallbackError: String(err?.message ?? err),
  };
}

export async function getSnapshot() {
  try {
    const { value } = await cached(CACHE_KEY, SNAPSHOT_TTL_MS, buildLiveSnapshot);
    return value;
  } catch (err) {
    const stale = getStale(CACHE_KEY);
    if (stale) {
      return { ...stale.value, source: "stale", staleError: String(err?.message ?? err) };
    }
    return buildFallbackSnapshot(err);
  }
}
