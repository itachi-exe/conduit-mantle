import AgentBrief from "./AgentBrief";

export default function Hero({ onOpenDashboard, onHowItWorks, onOpenChat, brief }) {
  return (
    <section className="relative overflow-hidden">
      <img src="/hero-bg.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/75 to-ink/10" />
      <div className="absolute inset-0 bg-gradient-to-t from-ink via-transparent to-ink/50" />

      <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-5 pb-14 pt-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 lg:px-8 lg:pb-28 lg:pt-24">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-hairline-strong px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-paper-dim">
            Research made easier, now live on Mantle
          </span>

          <h1 className="text-balance mt-6 font-delius text-[36px] font-normal leading-[1.08] tracking-[-0.02em] text-paper sm:text-[46px] lg:mt-7 lg:text-[64px] lg:leading-[1.03] lg:tracking-[-0.03em]">
            Read the chain.
            <br />
            Not just the charts.
          </h1>

          <p className="text-balance mt-5 max-w-lg text-[15px] leading-relaxed text-paper-dim lg:mt-6 lg:text-[18px]">
            The onchain research agent for Mantle. Raw chain data into signal.
            Interpreted in seconds.
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4 lg:mt-9">
            <button
              onClick={onOpenDashboard}
              className="w-full rounded-full bg-paper px-6 py-3 text-[14px] font-medium text-ink transition-opacity hover:opacity-85 sm:w-auto"
            >
              Open Dashboard
            </button>
            <button
              onClick={onHowItWorks}
              className="w-full rounded-full border border-hairline-strong px-6 py-3 text-[14px] font-medium text-paper transition-colors hover:border-paper sm:w-auto"
            >
              How it works
            </button>
          </div>
        </div>

        <button onClick={onOpenChat} className="group w-full text-left transition-transform hover:-translate-y-0.5">
          <AgentBrief
            label={brief.label}
            timestamp={brief.timestamp}
            lines={brief.lines}
            conclusion={brief.conclusion}
            conclusionStatus={brief.conclusionStatus}
            loading={brief.loading}
            caption="Click to ask the agent your own question →"
          />
        </button>
      </div>
    </section>
  );
}
