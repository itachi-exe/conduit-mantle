export function formatUsd(value, { compact = true } = {}) {
  if (compact) {
    const abs = Math.abs(value);
    if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  }
  return `$${value.toLocaleString("en-US")}`;
}

export function formatSignedUsd(value) {
  const sign = value >= 0 ? "+" : "-";
  return `${sign}${formatUsd(Math.abs(value))}`;
}

export function formatPct(value, { signed = false, digits = 1 } = {}) {
  const pct = value * 100;
  const sign = signed && pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(digits)}%`;
}

const SHORT_DATE = { month: "short", day: "numeric" };
const SHORT_TIME = { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" };

// "Jul 2", no ISO dashes. Used for chart axis ticks/tooltips.
export function formatShortDate(unixSecondsOrDate) {
  const d = unixSecondsOrDate instanceof Date ? unixSecondsOrDate : new Date(unixSecondsOrDate * 1000);
  return d.toLocaleDateString("en-US", SHORT_DATE);
}

// "Jul 2 · 08:12 UTC", no ISO dashes. Used for Agent Brief timestamps.
export function formatTimestamp(ms) {
  if (!ms) return null;
  const d = new Date(ms);
  return `${formatShortDate(d)} · ${d.toLocaleTimeString("en-US", SHORT_TIME)} UTC`;
}
