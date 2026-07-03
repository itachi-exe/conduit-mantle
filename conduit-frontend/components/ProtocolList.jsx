import { formatUsd, formatPct } from "@/shared/format";
import ProtocolLogo from "./ProtocolLogo";

export default function ProtocolList({ protocols, selectedId, onSelect }) {
  return (
    <ul className="flex flex-col gap-1">
      {protocols.map((protocol) => {
        const isSelected = protocol.slug === selectedId;
        return (
          <li key={protocol.slug}>
            <button
              onClick={() => onSelect(protocol.slug)}
              className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${
                isSelected ? "border-hairline-strong bg-ink-raised" : "border-transparent hover:bg-ink-raised/60"
              }`}
            >
              <ProtocolLogo
                src={protocol.logo}
                name={protocol.name}
                glyph={protocol.glyph}
                accent={protocol.accent}
                size={32}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-medium text-paper">{protocol.name}</div>
                <div className="truncate font-mono text-[11px] text-paper-faint">{protocol.category}</div>
              </div>
              <div className="text-right">
                <div className="font-mono text-[13px] text-paper">{formatUsd(protocol.tvl)}</div>
                <div
                  className={`font-mono text-[11px] ${protocol.pctChange7d >= 0 ? "text-signal" : "text-danger"}`}
                >
                  {formatPct(protocol.pctChange7d, { signed: true })}
                </div>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
