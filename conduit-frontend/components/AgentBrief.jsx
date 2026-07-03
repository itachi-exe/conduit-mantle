import TypedText from "./TypedText";

export default function AgentBrief({
  label = "Agent Brief",
  timestamp,
  text,
  lines,
  conclusion,
  conclusionStatus,
  sections,
  badge,
  caption,
  loading,
  error,
}) {
  return (
    <div className="rounded-2xl border border-hairline bg-panel p-5 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-[11px] uppercase tracking-wider text-paper-faint">
          {label}
          {timestamp && <span className="text-paper-faint"> · {timestamp}</span>}
        </span>
        {badge && (
          <span className="rounded-full border border-hairline-strong px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-signal">
            {badge}
          </span>
        )}
      </div>

      {loading ? (
        <div className="mt-4 space-y-2">
          <div className="skeleton h-4 w-full rounded" />
          <div className="skeleton h-4 w-11/12 rounded" />
          <div className="skeleton h-4 w-4/5 rounded" />
        </div>
      ) : error ? (
        <p className="mt-4 max-w-3xl font-mono text-[13px] leading-relaxed text-paper-faint">{error}</p>
      ) : (
        <>
          {text && (
            <p className="mt-4 max-w-3xl text-[15px] leading-relaxed text-paper-dim">
              <TypedText text={text} />
            </p>
          )}

          {lines && (
            <div className="mt-4 space-y-1.5 font-mono text-[13px] text-paper-dim">
              {lines.map((line) => (
                <div key={line}>
                  <span className="text-signal">{line.slice(0, 1)}</span>
                  {line.slice(1)}
                </div>
              ))}
              {conclusionStatus === "loading" && <div className="skeleton mt-3 h-4 w-4/5 rounded" />}
              {conclusionStatus === "error" && (
                <div className="mt-3 text-paper-faint">{conclusion}</div>
              )}
              {conclusionStatus === "ready" && (
                <div className="mt-3 text-paper">
                  <TypedText text={conclusion} />
                </div>
              )}
            </div>
          )}

          {sections && (
            <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-3">
              {sections.map((section) => (
                <div key={section.label}>
                  <div className="font-mono text-[11px] uppercase tracking-wider text-signal">{section.label}</div>
                  <p className="mt-2 text-[14px] leading-relaxed text-paper-dim">
                    <TypedText text={section.text} />
                  </p>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {caption && !loading && !error && (
        <div className="mt-4 border-t border-hairline pt-3 font-mono text-[11px] text-paper-faint">{caption}</div>
      )}
    </div>
  );
}
