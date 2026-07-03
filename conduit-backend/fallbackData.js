// FALLBACK ONLY. Used exclusively when live DefiLlama/RPC calls fail AND
// there is no stale cached snapshot to serve instead (e.g. first request,
// APIs down, offline dev). Every consumer of this module must set
// `source: "fallback"` on the response so the frontend can render an
// honest "showing last-known / illustrative data" notice instead of
// silently presenting it as live. This is never the default path.

export const FALLBACK_SNAPSHOT = {
  source: "fallback",
  generatedAt: null,
  ecosystem: {
    totalTvl: 231_000_000,
    tvl7dAgo: 226_000_000,
  },
  protocols: [
    { slug: "merchant-moe-liquidity-book", tvl: 18_800_000, tvl7dAgo: 18_300_000 },
    { slug: "agni-finance", tvl: 18_500_000, tvl7dAgo: 19_100_000 },
    { slug: "fluxion-network", tvl: 2_366_000, tvl7dAgo: 2_210_000 },
    { slug: "init-capital", tvl: 1_908_000, tvl7dAgo: 1_840_000 },
    { slug: "lendle-pooled-markets", tvl: 266_000, tvl7dAgo: 251_000 },
    { slug: "mantle-index-four-fund", tvl: 105_700_000, tvl7dAgo: 104_900_000 },
  ],
  heartbeat: null,
};
