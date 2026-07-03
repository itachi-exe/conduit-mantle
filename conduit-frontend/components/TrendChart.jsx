"use client";

import { useState, useMemo } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { formatUsd, formatShortDate } from "@/shared/format";

const RANGES = [
  { id: "7d", label: "7D", days: 7 },
  { id: "30d", label: "30D", days: 30 },
  { id: "all", label: "ALL", days: 90 },
];

function TrendTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-hairline-strong bg-ink-raised px-3 py-2 font-mono text-[12px]">
      <div className="text-paper-faint">{formatShortDate(label)}</div>
      <div className="mt-1 text-signal">{formatUsd(payload[0].value)} TVL</div>
    </div>
  );
}

export default function TrendChart({ data, accent = "var(--color-signal)" }) {
  const [range, setRange] = useState("30d");
  const activeRange = RANGES.find((r) => r.id === range);
  const sliced = useMemo(() => data.slice(-activeRange.days), [data, activeRange]);
  const values = sliced.map((p) => p.tvl);
  const yMin = Math.min(...values);
  const yMax = Math.max(...values);
  const pad = (yMax - yMin) * 0.1 || yMax * 0.1 || 1;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-[11px] uppercase tracking-wider text-paper-faint">
          Mantle TVL trend · live DefiLlama data
        </span>
        <div className="flex items-center gap-1 rounded-full border border-hairline p-1">
          {RANGES.map((r) => (
            <button
              key={r.id}
              onClick={() => setRange(r.id)}
              className={`rounded-full px-3 py-1 font-mono text-[11px] transition-colors ${
                range === r.id ? "bg-paper text-ink" : "text-paper-faint hover:text-paper"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={sliced} margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
            <CartesianGrid stroke="rgba(245,245,240,0.06)" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatShortDate}
              tick={{ fill: "rgba(245,245,240,0.4)", fontSize: 11, fontFamily: "IBM Plex Mono" }}
              tickLine={false}
              axisLine={{ stroke: "rgba(245,245,240,0.1)" }}
              minTickGap={40}
            />
            <YAxis
              domain={[yMin - pad, yMax + pad]}
              tickFormatter={(v) => formatUsd(v)}
              tick={{ fill: "rgba(245,245,240,0.4)", fontSize: 11, fontFamily: "IBM Plex Mono" }}
              tickLine={false}
              axisLine={false}
              width={56}
            />
            <Tooltip content={<TrendTooltip />} />
            <Line type="monotone" dataKey="tvl" stroke={accent} strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
