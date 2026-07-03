import { formatPct, formatSignedUsd } from "@/shared/format";
import TypedText from "./TypedText";

export default function SignalCard({ signal, interpretation, interpretationStatus, onView, loading }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-signal/30 bg-panel p-5 lg:p-8">
      <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-signal/10 blur-3xl" />

      <div className="relative flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-[11px] uppercase tracking-wider text-signal">The Signal</span>
        <span className="rounded-full bg-signal-dim px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-signal">
          Ranked by magnitude × unusualness
        </span>
      </div>

      {loading ? (
        <div className="relative mt-5 space-y-3">
          <div className="skeleton h-12 w-64 rounded-md" />
          <div className="skeleton h-4 w-full max-w-xl rounded" />
        </div>
      ) : (
        <div className="relative mt-5">
          <div className="font-mono text-[11px] uppercase tracking-wider text-paper-faint">
            {signal.name} · {signal.category} · 7d TVL change
          </div>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-mono text-4xl font-medium tracking-tight text-paper lg:text-5xl">
              {formatPct(signal.pctChange7d, { signed: true })}
            </span>
            <span className="font-mono text-lg text-signal">{formatSignedUsd(signal.usdChange7d)}</span>
            <span className="font-mono text-[13px] text-paper-faint">{signal.unusualness}x typical weekly move</span>
          </div>

          {interpretationStatus === "loading" && (
            <div className="mt-4 space-y-2">
              <div className="skeleton h-4 w-full max-w-xl rounded" />
              <div className="skeleton h-4 w-2/3 rounded" />
            </div>
          )}
          {interpretationStatus === "error" && (
            <p className="mt-4 max-w-2xl font-mono text-[13px] text-paper-faint">{interpretation}</p>
          )}
          {interpretationStatus === "ready" && (
            <p className="mt-4 max-w-2xl text-[16px] italic leading-relaxed text-paper-dim">
              <TypedText text={interpretation} />
            </p>
          )}

          <button
            onClick={onView}
            className="mt-6 rounded-full border border-hairline-strong px-4 py-2 font-mono text-[13px] text-paper transition-colors hover:border-signal hover:text-signal"
          >
            View {signal.ticker} →
          </button>
        </div>
      )}
    </div>
  );
}
