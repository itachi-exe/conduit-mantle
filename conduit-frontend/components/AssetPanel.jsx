import ProtocolList from "./ProtocolList";
import ProtocolLogo from "./ProtocolLogo";
import TrendChart from "./TrendChart";
import AgentBrief from "./AgentBrief";
import { formatUsd, formatSignedUsd, formatPct } from "@/shared/format";

export default function AssetPanel({ protocols, selectedId, onSelect, onBack, brief }) {
  const protocol = protocols.find((p) => p.slug === selectedId) ?? protocols[0];

  return (
    <section id="asset-view" className="mx-auto max-w-6xl px-5 py-10 lg:px-8 lg:py-16">
      <button
        onClick={onBack}
        className="mb-6 flex items-center gap-2 font-mono text-[13px] text-paper-faint transition-colors hover:text-paper lg:mb-8"
      >
        ← Back to dashboard
      </button>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr] lg:gap-8">
        <aside className="rounded-2xl border border-hairline bg-panel p-3">
          <div className="px-3 pb-2 pt-1 font-mono text-[11px] uppercase tracking-wider text-paper-faint">
            Protocols · live DefiLlama TVL
          </div>
          <ProtocolList protocols={protocols} selectedId={protocol.slug} onSelect={onSelect} />
        </aside>

        <div className="min-w-0 space-y-6 lg:space-y-8">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <ProtocolLogo
                src={protocol.logo}
                name={protocol.name}
                glyph={protocol.glyph}
                accent={protocol.accent}
                size={48}
              />
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-paper lg:text-2xl">{protocol.name}</h2>
                <div className="font-mono text-[13px] text-paper-faint">
                  {protocol.ticker} · {protocol.category}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-hairline bg-panel p-5">
              <div className="font-mono text-[11px] uppercase tracking-wider text-paper-faint">TVL (Mantle)</div>
              <div className="mt-2 font-mono text-2xl text-paper">{formatUsd(protocol.tvl)}</div>
              <div className={`mt-1 font-mono text-[12px] ${protocol.pctChange7d >= 0 ? "text-signal" : "text-danger"}`}>
                {formatPct(protocol.pctChange7d, { signed: true })} · 7d
              </div>
            </div>
            <div className="rounded-2xl border border-hairline bg-panel p-5">
              <div className="font-mono text-[11px] uppercase tracking-wider text-paper-faint">TVL change (7d)</div>
              <div className="mt-2 font-mono text-2xl text-paper">{formatSignedUsd(protocol.usdChange7d)}</div>
              <div className="mt-1 font-mono text-[12px] text-paper-faint">
                {protocol.usdChange7d >= 0 ? "inflow" : "outflow"} vs 7d ago
              </div>
            </div>
            <div className="rounded-2xl border border-hairline bg-panel p-5">
              <div className="font-mono text-[11px] uppercase tracking-wider text-paper-faint">Composability class</div>
              <div className="mt-2 text-[15px] text-paper">
                {protocol.activeCategory ? "Actively deployed" : "Passive / held"}
              </div>
              <div className="mt-1 font-mono text-[12px] text-paper-faint">
                {protocol.category} category
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-hairline bg-panel p-4 lg:p-6">
            <TrendChart data={protocol.trend} accent={protocol.accent} />
          </div>

          <AgentBrief
            label={`${protocol.name} · Agent Brief`}
            badge="Generated live"
            caption="Engine: DeepSeek (deepseek-v4-flash), called at runtime with this protocol's live ranked signal. Architected for Mantle AI Agent Skills. No public SDK for this was available as of build time; see README."
            loading={brief.status === "loading"}
            error={brief.status === "error" ? brief.error : null}
            sections={
              brief.status === "ready"
                ? [
                    { label: "What's happening", text: brief.sections.whatsHappening },
                    { label: "Why it matters", text: brief.sections.whyItMatters },
                    { label: "What to watch next", text: brief.sections.whatToWatch },
                  ]
                : null
            }
          />
        </div>
      </div>
    </section>
  );
}
