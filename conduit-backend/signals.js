// Real signal detection: ranks tracked protocols by how much their 7-day
// TVL move stands out against their *own* recent volatility, not just raw
// dollar size. A big protocol drifting +1% isn't a signal; a small
// protocol jumping 3x its typical weekly swing is.

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

export function rankSignals(protocols) {
  const scored = protocols.map((protocol) => {
    const pctChange7d = protocol.tvl7dAgo > 0 ? (protocol.tvl - protocol.tvl7dAgo) / protocol.tvl7dAgo : 0;
    const usdChange7d = protocol.tvl - protocol.tvl7dAgo;

    const returns = dailyReturns(protocol.trend);
    const dailyStdev = stdev(returns);
    const typicalWeeklyMove = Math.max(dailyStdev * Math.sqrt(7), 0.01);
    const unusualness = Math.min(Math.abs(pctChange7d) / typicalWeeklyMove, 8);

    const significance = Math.abs(pctChange7d) * 100 * unusualness;

    return {
      slug: protocol.slug,
      name: protocol.name,
      ticker: protocol.ticker,
      category: protocol.category,
      pctChange7d,
      usdChange7d,
      unusualness: Number(unusualness.toFixed(2)),
      significance: Number(significance.toFixed(2)),
    };
  });

  return scored.sort((a, b) => b.significance - a.significance);
}

export function computeComposability(protocols) {
  let active = 0;
  let idle = 0;
  for (const protocol of protocols) {
    if (protocol.activeCategory) active += protocol.tvl;
    else idle += protocol.tvl;
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

export function computeNetFlow7d(protocols) {
  const value = protocols.reduce((sum, p) => sum + (p.tvl - p.tvl7dAgo), 0);
  return { value, direction: value >= 0 ? "in" : "out" };
}
