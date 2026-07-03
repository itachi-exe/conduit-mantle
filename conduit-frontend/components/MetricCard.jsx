export default function MetricCard({ label, value, delta, deltaPositive, onClick, children, loading }) {
  const Tag = onClick ? "button" : "div";

  return (
    <Tag
      onClick={onClick}
      className={`group flex flex-col justify-between rounded-2xl border border-hairline bg-panel p-5 text-left transition-colors lg:p-6 ${
        onClick ? "cursor-pointer hover:border-hairline-strong" : ""
      }`}
    >
      <div className="flex items-start justify-between">
        <span className="font-mono text-[11px] uppercase tracking-wider text-paper-faint">{label}</span>
        {onClick && (
          <span className="font-mono text-[11px] text-paper-faint opacity-0 transition-opacity group-hover:opacity-100">
            view →
          </span>
        )}
      </div>

      <div className="mt-6 flex items-end justify-between gap-4">
        <div>
          {loading ? (
            <div className="skeleton h-9 w-28 rounded-md" />
          ) : (
            <div className="font-mono text-4xl font-medium tracking-tight text-paper">{value}</div>
          )}
          {delta && !loading && (
            <div className={`mt-2 font-mono text-[13px] ${deltaPositive ? "text-signal" : "text-danger"}`}>
              {delta}
            </div>
          )}
        </div>
        {children}
      </div>
    </Tag>
  );
}
