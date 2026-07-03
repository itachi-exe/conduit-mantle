#!/usr/bin/env node

// Dependency-free (Node 18+, uses only built-in fetch) Mantle data tools.
// Same real Mantle RPC + DefiLlama pipeline as the Conduit dashboard and
// its chat agent's tool-use — ported here with zero npm install so any
// LLM/agent with a bash or code-execution tool can run it directly.
// Every call hits a live endpoint at run time; nothing is cached or canned.

const RPC_URL = process.env.MANTLE_RPC_URL || "https://rpc.mantle.xyz";
const LLAMA = "https://api.llama.fi";
const DAY = 86400;

const TRACKED_PROTOCOLS = [
  { slug: "merchant-moe-liquidity-book", name: "Merchant Moe", ticker: "MOE", category: "Dexs", activeCategory: true },
  { slug: "agni-finance", name: "Agni Finance", ticker: "AGNI", category: "Dexs", activeCategory: true },
  { slug: "fluxion-network", name: "Fluxion Network", ticker: "FLUX", category: "Dexs", activeCategory: true },
  { slug: "init-capital", name: "INIT Capital", ticker: "INIT", category: "Lending", activeCategory: true },
  { slug: "lendle-pooled-markets", name: "Lendle", ticker: "LEND", category: "Lending", activeCategory: true },
  { slug: "mantle-index-four-fund", name: "Mantle Index Four Fund", ticker: "MI4", category: "RWA", activeCategory: false },
];

// A handful of concurrent connections to the same host occasionally hit a
// transient connect timeout (sandboxed/rate-limited networks especially) even
// though each request works fine on its own — one retry after a short delay
// clears that without masking a genuinely dead endpoint.
async function withRetry(fn, retries = 2) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= retries) throw err;
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
}

async function getJson(url, timeoutMs = 8000) {
  return withRetry(async () => {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) throw new Error(`DefiLlama ${res.status} on ${url}`);
    return res.json();
  });
}

async function rpc(method, params = []) {
  return withRetry(async () => {
    const res = await fetch(RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: AbortSignal.timeout(8000),
    });
    const json = await res.json();
    if (json.error) throw new Error(json.error.message);
    return json.result;
  });
}

async function getChainHeartbeat() {
  const [blockHex, block, gasPriceHex] = await Promise.all([
    rpc("eth_blockNumber"),
    rpc("eth_getBlockByNumber", ["latest", false]),
    rpc("eth_gasPrice"),
  ]);
  return {
    chainId: 5000,
    blockNumber: BigInt(blockHex).toString(),
    blockTimestamp: Number(BigInt(block.timestamp)),
    gasPriceGwei: (Number(BigInt(gasPriceHex)) / 1e9).toFixed(3),
    rpcUrl: RPC_URL,
  };
}

function daysAgo(n) {
  return Math.floor(Date.now() / 1000) - n * DAY;
}

function findClosest(series, targetUnix) {
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

async function getChainTvlHistory() {
  const series = await getJson(`${LLAMA}/v2/historicalChainTvl/Mantle`);
  return series.map((p) => ({ date: p.date, tvl: p.tvl }));
}

async function getProtocolMantleHistory(slug, timeoutMs = 8000) {
  const data = await getJson(`${LLAMA}/protocol/${slug}`, timeoutMs);
  const series = data?.chainTvls?.Mantle?.tvl ?? [];
  return {
    logo: data?.logo ?? null,
    history: series.map((p) => ({ date: p.date, tvl: p.totalLiquidityUSD })),
  };
}

function dailyReturns(trend) {
  const returns = [];
  for (let i = 1; i < trend.length; i++) {
    const prev = trend[i - 1].tvl;
    const curr = trend[i].tvl;
    if (prev > 0) returns.push((curr - prev) / prev);
  }
  return returns;
}

function stdev(values) {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

// Ranks protocols by how much their 7d TVL move stands out against their
// OWN recent volatility, not raw dollar size — a big protocol drifting +1%
// isn't a signal, a small one moving 3x its usual weekly swing is.
function rankSignals(protocols) {
  return protocols
    .map((p) => {
      const pctChange7d = p.tvl7dAgo > 0 ? (p.tvl - p.tvl7dAgo) / p.tvl7dAgo : 0;
      const returns = dailyReturns(p.trend);
      const typicalWeeklyMove = Math.max(stdev(returns) * Math.sqrt(7), 0.01);
      const unusualness = Math.min(Math.abs(pctChange7d) / typicalWeeklyMove, 8);
      return {
        slug: p.slug,
        name: p.name,
        ticker: p.ticker,
        category: p.category,
        pctChange7d,
        usdChange7d: p.tvl - p.tvl7dAgo,
        unusualness: Number(unusualness.toFixed(2)),
        significance: Number((Math.abs(pctChange7d) * 100 * unusualness).toFixed(2)),
      };
    })
    .sort((a, b) => b.significance - a.significance);
}

function computeComposability(protocols) {
  let active = 0;
  let idle = 0;
  for (const p of protocols) {
    if (p.activeCategory) active += p.tvl;
    else idle += p.tvl;
  }
  const total = active + idle || 1;
  return {
    activePct: Number(((active / total) * 100).toFixed(1)),
    idlePct: Number(((idle / total) * 100).toFixed(1)),
    activeUsd: active,
    idleUsd: idle,
    trackedTvl: total,
  };
}

function computeNetFlow7d(protocols) {
  const value = protocols.reduce((sum, p) => sum + (p.tvl - p.tvl7dAgo), 0);
  return { value, direction: value >= 0 ? "in" : "out" };
}

async function buildSnapshot() {
  const [chainTvlHistory, heartbeat, protocolHistories] = await Promise.all([
    getChainTvlHistory(),
    getChainHeartbeat().catch((err) => ({ error: String(err?.message ?? err) })),
    Promise.all(
      TRACKED_PROTOCOLS.map(async (p) => {
        const { history } = await getProtocolMantleHistory(p.slug);
        return { ...p, history };
      })
    ),
  ]);

  const latestChain = chainTvlHistory[chainTvlHistory.length - 1];
  const chain7dAgo = findClosest(chainTvlHistory, daysAgo(7));

  const protocols = protocolHistories.map((p) => {
    const { history, ...meta } = p;
    const latest = history[history.length - 1];
    const point7dAgo = findClosest(history, daysAgo(7));
    return {
      ...meta,
      tvl: latest?.tvl ?? 0,
      tvl7dAgo: point7dAgo?.tvl ?? latest?.tvl ?? 0,
      trend: history.filter((pt) => pt.date >= daysAgo(90)).map((pt) => ({ date: pt.date, tvl: pt.tvl })),
    };
  });

  return {
    ecosystem: {
      totalTvl: latestChain?.tvl ?? 0,
      tvl7dAgo: chain7dAgo?.tvl ?? latestChain?.tvl ?? 0,
    },
    protocols: protocols.map(({ trend: _trend, ...rest }) => rest),
    signals: rankSignals(protocols),
    composability: computeComposability(protocols),
    netFlow: computeNetFlow7d(protocols),
    heartbeat,
  };
}

async function searchProtocols(query) {
  const all = await getJson(`${LLAMA}/protocols`, 20_000);
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

async function protocolDetail(slug) {
  const { logo, history } = await getProtocolMantleHistory(slug, 15_000);
  if (!history.length) return null;
  const latest = history[history.length - 1];
  return {
    slug,
    logo,
    tvlUsd: latest.tvl,
    tvl7dAgoUsd: findClosest(history, daysAgo(7))?.tvl ?? latest.tvl,
    tvl30dAgoUsd: findClosest(history, daysAgo(30))?.tvl ?? latest.tvl,
    asOf: new Date(latest.date * 1000).toISOString(),
    url: `https://defillama.com/protocol/${slug}`,
  };
}

const [, , cmd, ...args] = process.argv;

async function main() {
  switch (cmd) {
    case "snapshot":
      return await buildSnapshot();
    case "status":
      return await getChainHeartbeat();
    case "search":
      return await searchProtocols(args.join(" "));
    case "detail":
      return await protocolDetail(args[0]);
    default:
      console.error('Usage: node conduit.mjs <snapshot | status | search "name" | detail <defillama-slug>>');
      process.exit(1);
  }
}

main()
  .then((result) => console.log(JSON.stringify(result, null, 2)))
  .catch((err) => {
    console.log(JSON.stringify({ error: String(err?.message ?? err) }));
    process.exit(1);
  });
