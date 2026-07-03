"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import NavBar from "@/conduit-frontend/components/NavBar";
import Hero from "@/conduit-frontend/components/Hero";
import MetricCard from "@/conduit-frontend/components/MetricCard";
import CompositionRatio from "@/conduit-frontend/components/CompositionRatio";
import AgentBrief from "@/conduit-frontend/components/AgentBrief";
import SignalCard from "@/conduit-frontend/components/SignalCard";
import AssetPanel from "@/conduit-frontend/components/AssetPanel";
import StatsRow from "@/conduit-frontend/components/StatsRow";
import Footer from "@/conduit-frontend/components/Footer";
import ResearchChat from "@/conduit-frontend/components/ResearchChat";
import CopyCommand from "@/conduit-frontend/components/CopyCommand";
import Docs from "@/conduit-frontend/components/Docs";
import { formatUsd, formatSignedUsd, formatPct, formatTimestamp } from "@/shared/format";

const HOW_IT_WORKS_STEPS = [
  {
    step: "01",
    title: "Ingest",
    text: "A Next.js API route reads live Mantle mainnet via RPC (viem) and pulls real per-chain TVL history from DefiLlama for a set of near-native Mantle protocols.",
  },
  {
    step: "02",
    title: "Interpret",
    text: "A signal-ranking function diffs current vs. 7-day-ago TVL for each protocol and scores it by magnitude × how unusual the move is against that protocol's own volatility.",
  },
  {
    step: "03",
    title: "Brief",
    text: "The top-ranked signals are handed to an LLM at request time, which writes the interpretation live. Nothing below is a pre-written string.",
  },
];

async function postBrief(payload) {
  const res = await fetch("/api/brief", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || "Agent brief unavailable.");
  }
  return json;
}

export default function Page() {
  const [view, setView] = useState("landing");
  const [snapshot, setSnapshot] = useState(null);
  const [signalData, setSignalData] = useState(null);
  const [snapshotError, setSnapshotError] = useState(null);
  const [selectedSlug, setSelectedSlug] = useState(null);
  const [pendingScroll, setPendingScroll] = useState(null);

  const [ecosystemBrief, setEcosystemBrief] = useState({ status: "idle", text: null, error: null });
  const [signalBrief, setSignalBrief] = useState({ status: "idle", text: null, error: null });
  const [assetBriefs, setAssetBriefs] = useState({});

  const sectionRefs = useRef({});

  // Live data layer: real Mantle RPC + DefiLlama, no hardcoded numbers.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [snapRes, sigRes] = await Promise.all([fetch("/api/snapshot"), fetch("/api/signal")]);
        const [snap, sig] = await Promise.all([snapRes.json(), sigRes.json()]);
        if (cancelled) return;
        setSnapshot(snap);
        setSignalData(sig);
        setSelectedSlug((current) => current ?? sig.topSignal?.slug ?? null);
      } catch (err) {
        if (!cancelled) setSnapshotError(String(err?.message ?? err));
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Agent layer: real LLM calls, fired once live data is in.
  useEffect(() => {
    if (!snapshot || !signalData || ecosystemBrief.status !== "idle") return;
    setEcosystemBrief({ status: "loading", text: null, error: null });
    postBrief({ type: "ecosystem" })
      .then((res) => setEcosystemBrief({ status: "ready", text: res.text, error: null }))
      .catch((err) => setEcosystemBrief({ status: "error", text: null, error: err.message }));
  }, [snapshot, signalData, ecosystemBrief.status]);

  useEffect(() => {
    if (!signalData?.topSignal || signalBrief.status !== "idle") return;
    setSignalBrief({ status: "loading", text: null, error: null });
    postBrief({ type: "signal" })
      .then((res) => setSignalBrief({ status: "ready", text: res.text, error: null }))
      .catch((err) => setSignalBrief({ status: "error", text: null, error: err.message }));
  }, [signalData, signalBrief.status]);

  useEffect(() => {
    if (view !== "asset" || !selectedSlug) return;
    if (assetBriefs[selectedSlug]) return;
    setAssetBriefs((prev) => ({ ...prev, [selectedSlug]: { status: "loading", sections: null, error: null } }));
    postBrief({ type: "asset", slug: selectedSlug })
      .then((res) =>
        setAssetBriefs((prev) => ({ ...prev, [selectedSlug]: { status: "ready", sections: res.sections, error: null } }))
      )
      .catch((err) =>
        setAssetBriefs((prev) => ({ ...prev, [selectedSlug]: { status: "error", sections: null, error: err.message } }))
      );
  }, [view, selectedSlug, assetBriefs]);

  useEffect(() => {
    if (view !== "landing" || !pendingScroll) return;
    const target = sectionRefs.current[pendingScroll];
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    setPendingScroll(null);
  }, [view, pendingScroll]);

  const mergedProtocols = useMemo(() => {
    if (!snapshot || !signalData) return [];
    return snapshot.protocols.map((protocol) => ({
      ...protocol,
      ...(signalData.signals.find((s) => s.slug === protocol.slug) ?? {}),
    }));
  }, [snapshot, signalData]);

  function openAsset(slug) {
    setSelectedSlug(slug);
    setView("asset");
    window.scrollTo({ top: 0 });
  }

  function openChat() {
    setView("chat");
    window.scrollTo({ top: 0 });
  }

  function openDocs() {
    setView("docs");
    window.scrollTo({ top: 0 });
  }

  function backToDashboard() {
    setView("landing");
    setPendingScroll("ecosystem");
  }

  function navigate(target) {
    if (target === "top") {
      setView("landing");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (view !== "landing") setView("landing");
    setPendingScroll(target);
  }

  const dataLoading = !snapshot || !signalData;

  const suggestedPrompts = useMemo(() => {
    if (dataLoading) return [];
    const top = signalData.topSignal;
    const lending = mergedProtocols.find((p) => p.category === "Lending");
    const dex = mergedProtocols.find((p) => p.category === "Dexs" && p.slug !== top.slug);
    return [
      `Why did ${top.name} move ${formatPct(top.pctChange7d, { signed: true })} this week?`,
      `What does the ${signalData.composability.activePct}% composability ratio mean?`,
      lending && dex ? `Compare ${lending.name} and ${dex.name}` : `Which tracked protocol should I watch next?`,
    ];
  }, [dataLoading, signalData, mergedProtocols]);

  const heroLines = dataLoading
    ? []
    : [
        `> connected to Mantle mainnet · block #${snapshot.heartbeat?.blockNumber ?? "…"}`,
        `> tracked TVL: ${formatUsd(snapshot.ecosystem.totalTvl)} (${formatPct(
          (snapshot.ecosystem.totalTvl - snapshot.ecosystem.tvl7dAgo) / snapshot.ecosystem.tvl7dAgo,
          { signed: true }
        )} 7d)`,
        `> composability: ${signalData.composability.activePct}% active / ${signalData.composability.idlePct}% idle`,
        `> top signal: ${signalData.topSignal?.name} ${formatPct(signalData.topSignal?.pctChange7d ?? 0, { signed: true })} (7d)`,
      ];

  return (
    <div id="top">
      <NavBar
        onNavigate={navigate}
        onOpenDashboard={() => navigate("ecosystem")}
        onOpenChat={openChat}
        onOpenDocs={openDocs}
      />

      {snapshotError && (
        <div className="border-b border-danger/30 bg-danger/10 px-5 py-3 text-center font-mono text-[12px] text-danger lg:px-8">
          Live data fetch failed: {snapshotError}
        </div>
      )}
      {snapshot?.source === "fallback" && (
        <div className="border-b border-hairline-strong bg-ink-raised px-5 py-3 text-center font-mono text-[12px] text-paper-faint lg:px-8">
          ⚠ Live sources unreachable. Showing clearly-labeled fallback data, not live Mantle data.
        </div>
      )}
      {snapshot?.source === "stale" && (
        <div className="border-b border-hairline-strong bg-ink-raised px-5 py-3 text-center font-mono text-[12px] text-paper-faint lg:px-8">
          ⚠ Live refresh failed. Showing the last known-good snapshot.
        </div>
      )}

      {view === "landing" && (
        <main>
          <Hero
            onOpenDashboard={() => navigate("ecosystem")}
            onHowItWorks={() => navigate("how-it-works")}
            onOpenChat={openChat}
            brief={{
              label: "Agent Brief · Live",
              timestamp: formatTimestamp(snapshot?.generatedAt),
              lines: dataLoading ? null : heroLines,
              conclusion: ecosystemBrief.status === "ready" ? ecosystemBrief.text : ecosystemBrief.error,
              conclusionStatus: ecosystemBrief.status,
              loading: dataLoading,
            }}
          />

          <section className="border-t border-hairline">
            <div className="mx-auto max-w-6xl px-5 py-14 lg:px-8 lg:py-20">
              <span className="font-mono text-[11px] uppercase tracking-wider text-paper-faint">Terminal</span>
              <h2 className="mt-2 max-w-xl text-2xl font-semibold tracking-tight text-paper lg:text-3xl">
                Same agent, in your terminal.
              </h2>
              <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-paper-dim lg:text-[15px]">
                Real tool-calling, real Mantle data, real web search when the agent needs it. No browser required.
              </p>
              <div className="mt-6 max-w-md">
                <CopyCommand command="npx conduit-mantle" />
              </div>

              <div className="mt-10 max-w-xl border-t border-hairline pt-8">
                <span className="font-mono text-[11px] uppercase tracking-wider text-paper-faint">Skill</span>
                <h3 className="mt-2 text-xl font-semibold tracking-tight text-paper">
                  Give any LLM the skill.
                </h3>
                <p className="mt-3 text-[15px] leading-relaxed text-paper-dim">
                  A self-contained skill package, no npm install, no API key, just Node 18+.
                  Upload it to your LLM as a skill, or drop it into any agent that can run a
                  script, and it can pull live Mantle data mid-conversation.
                </p>
                <a
                  href="/downloads/conduit-mantle-skill.zip"
                  download
                  className="mt-5 inline-flex items-center gap-2 rounded-full border border-hairline-strong px-5 py-2.5 text-[13px] font-medium text-paper transition-colors hover:border-paper"
                >
                  Download conduit-mantle-skill.zip
                </a>
              </div>
            </div>
          </section>

          <section
            id="ecosystem"
            ref={(el) => (sectionRefs.current.ecosystem = el)}
            className="mx-auto max-w-6xl px-5 py-14 lg:px-8 lg:py-20"
          >
            <div className="mb-8 flex items-end justify-between">
              <div>
                <span className="font-mono text-[11px] uppercase tracking-wider text-paper-faint">
                  Ecosystem Snapshot · live
                </span>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-paper lg:text-3xl">Mantle, right now</h2>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <MetricCard
                label="Total Mantle TVL"
                value={dataLoading ? null : formatUsd(snapshot.ecosystem.totalTvl)}
                delta={
                  dataLoading
                    ? null
                    : formatPct((snapshot.ecosystem.totalTvl - snapshot.ecosystem.tvl7dAgo) / snapshot.ecosystem.tvl7dAgo, {
                        signed: true,
                      }) + " · 7d"
                }
                deltaPositive={!dataLoading && snapshot.ecosystem.totalTvl >= snapshot.ecosystem.tvl7dAgo}
                onClick={dataLoading ? undefined : () => openAsset(signalData.topSignal.slug)}
                loading={dataLoading}
              />
              <MetricCard
                label="Composability (tracked protocols)"
                value={dataLoading ? null : `${signalData.composability.activePct}% active`}
                onClick={dataLoading ? undefined : () => openAsset(signalData.topSignal.slug)}
                loading={dataLoading}
              >
                {!dataLoading && (
                  <CompositionRatio active={signalData.composability.activePct} idle={signalData.composability.idlePct} />
                )}
              </MetricCard>
              <MetricCard
                label="Net Capital Flow (7d)"
                value={dataLoading ? null : formatSignedUsd(signalData.netFlow.value)}
                delta={dataLoading ? null : signalData.netFlow.direction === "in" ? "↗ inflow" : "↘ outflow"}
                deltaPositive={!dataLoading && signalData.netFlow.direction === "in"}
                onClick={dataLoading ? undefined : () => openAsset(signalData.topSignal.slug)}
                loading={dataLoading}
              />
            </div>

            <div className="mt-4">
              <AgentBrief
                timestamp={formatTimestamp(snapshot?.generatedAt)}
                text={ecosystemBrief.status === "ready" ? ecosystemBrief.text : null}
                loading={dataLoading || ecosystemBrief.status === "loading"}
                error={ecosystemBrief.status === "error" ? ecosystemBrief.error : null}
                badge="Generated live"
              />
            </div>
          </section>

          <section className="mx-auto max-w-6xl px-5 pb-14 lg:px-8 lg:pb-20">
            {dataLoading ? (
              <SignalCard loading />
            ) : (
              <SignalCard
                signal={signalData.topSignal}
                interpretation={signalBrief.status === "ready" ? signalBrief.text : signalBrief.error}
                interpretationStatus={signalBrief.status}
                onView={() => openAsset(signalData.topSignal.slug)}
              />
            )}
          </section>

          <section
            id="how-it-works"
            ref={(el) => (sectionRefs.current["how-it-works"] = el)}
            className="border-t border-hairline"
          >
            <div className="mx-auto max-w-6xl px-5 py-14 lg:px-8 lg:py-20">
              <span className="font-mono text-[11px] uppercase tracking-wider text-paper-faint">How it works</span>
              <h2 className="mt-2 max-w-xl text-2xl font-semibold tracking-tight text-paper lg:text-3xl">
                From raw chain data to a written brief, for real.
              </h2>

              <div className="mt-10 grid grid-cols-1 gap-8 lg:mt-12 lg:grid-cols-3">
                {HOW_IT_WORKS_STEPS.map((item) => (
                  <div key={item.step}>
                    <div className="font-mono text-[13px] text-signal">{item.step}</div>
                    <h3 className="mt-3 text-lg font-semibold text-paper">{item.title}</h3>
                    <p className="mt-2 text-[14px] leading-relaxed text-paper-dim">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <StatsRow
            stats={
              dataLoading
                ? [
                    { value: "…", label: "near-native Mantle protocols tracked" },
                    { value: "…", label: "Mantle TVL surfaced live" },
                    { value: "…", label: "latest Mantle block read" },
                  ]
                : [
                    { value: String(mergedProtocols.length), label: "near-native Mantle protocols tracked" },
                    { value: formatUsd(snapshot.ecosystem.totalTvl), label: "Mantle TVL surfaced live" },
                    { value: snapshot.heartbeat?.blockNumber ? `#${snapshot.heartbeat.blockNumber}` : "n/a", label: "latest Mantle block read" },
                  ]
            }
          />
        </main>
      )}

      {view === "asset" && !dataLoading && (
        <main>
          <AssetPanel
            protocols={mergedProtocols}
            selectedId={selectedSlug}
            onSelect={setSelectedSlug}
            onBack={backToDashboard}
            brief={assetBriefs[selectedSlug] ?? { status: "loading" }}
          />
        </main>
      )}

      {view === "chat" && (
        <main>
          <ResearchChat onBack={backToDashboard} suggestedPrompts={suggestedPrompts} />
        </main>
      )}

      {view === "docs" && (
        <main>
          <Docs onBack={backToDashboard} />
        </main>
      )}

      {view !== "chat" && (
        <div ref={(el) => (sectionRefs.current.footer = el)}>
          <Footer onOpenDocs={openDocs} />
        </div>
      )}
    </div>
  );
}
