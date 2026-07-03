const COLUMNS = [
  {
    title: "Product",
    links: ["Dashboard", "Agent Briefs", "Signal Feed", "Protocol Index"],
  },
  {
    title: "Developers",
    links: ["Docs", "Agent Skills API", "Changelog", "Status"],
  },
  {
    title: "Company",
    links: ["About", "Mantle Research Challenge", "Contact"],
  },
  {
    title: "Social",
    links: ["X", "GitHub", "Discord"],
  },
];

export default function Footer({ onOpenDocs }) {
  return (
    <footer id="footer" className="border-t border-hairline">
      <div className="mx-auto max-w-6xl px-5 py-12 lg:px-8 lg:py-16">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-5 lg:gap-8">
          <div className="col-span-2 sm:col-span-3 lg:col-span-1">
            <div className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-paper">
              <img src="/conduit-logo.png" alt="" width={24} height={24} className="h-6 w-6 rounded-[6px]" />
              Conduit
            </div>
            <p className="mt-3 max-w-[180px] text-[13px] leading-relaxed text-paper-faint">
              The onchain research agent for Mantle.
            </p>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.title}>
              <div className="font-mono text-[11px] uppercase tracking-wider text-paper-faint">{column.title}</div>
              <ul className="mt-4 space-y-3">
                {column.links.map((link) =>
                  link === "Docs" ? (
                    <li key={link}>
                      <button
                        onClick={onOpenDocs}
                        className="text-[13px] text-paper-dim transition-colors hover:text-paper"
                      >
                        {link}
                      </button>
                    </li>
                  ) : (
                    <li key={link}>
                      <a href="#top" className="text-[13px] text-paper-dim transition-colors hover:text-paper">
                        {link}
                      </a>
                    </li>
                  )
                )}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-hairline pt-8 text-center font-mono text-[12px] text-paper-faint sm:flex-row sm:items-center sm:justify-between sm:text-left lg:mt-16">
          <span>Built for the Mantle Research Challenge</span>
          <span>© 2026 Conduit</span>
        </div>
      </div>
    </footer>
  );
}
