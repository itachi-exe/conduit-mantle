import { NextResponse } from "next/server";
import { getSnapshot } from "@/conduit-backend/snapshot";
import { rankSignals, computeComposability, computeNetFlow7d } from "@/conduit-backend/signals";
import { generateEcosystemBrief, generateSignalBrief, generateAssetBrief, isClaudeConfigured } from "@/conduit-agent/agent";
import { isDeepSeekConfigured, formatDeepSeekError } from "@/conduit-agent/deepseek";
import { cached } from "@/conduit-backend/cache";

// Briefs are real LLM calls, not free, so this caps how often any of the
// three kinds actually hits a provider, regardless of how many visitors load
// the dashboard in that window. Every request in between gets the same text,
// streamed to the client exactly like a fresh call (see AgentBrief/TypedText
// on the frontend, which has no notion of caching either way).
const BRIEF_TTL_MS = 5 * 60 * 60 * 1000;

export async function POST(request) {
  if (!isDeepSeekConfigured() && !isClaudeConfigured()) {
    return NextResponse.json(
      { error: "agent_not_configured", message: "Agent commentary isn't available right now." },
      { status: 503 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request", message: "Expected JSON body." }, { status: 400 });
  }

  const { type, slug } = body ?? {};
  const snapshot = await getSnapshot();
  const signals = rankSignals(snapshot.protocols);
  const topSignal = signals[0];

  if (!topSignal) {
    return NextResponse.json({ error: "no_data", message: "No signals available yet." }, { status: 503 });
  }

  try {
    if (type === "ecosystem") {
      const composability = computeComposability(snapshot.protocols);
      const netFlow = computeNetFlow7d(snapshot.protocols);
      const { value: text } = await cached("brief:ecosystem", BRIEF_TTL_MS, () =>
        generateEcosystemBrief({ ecosystem: snapshot.ecosystem, composability, netFlow, topSignal })
      );
      return NextResponse.json({ type, text, source: snapshot.source, generatedAt: Date.now() });
    }

    if (type === "signal") {
      // Keyed by slug, not a flat key, so a cached writeup can never end up
      // describing a different protocol than the one the dashboard's
      // (independently, more frequently refreshed) numbers are showing.
      const { value: text } = await cached(`brief:signal:${topSignal.slug}`, BRIEF_TTL_MS, () =>
        generateSignalBrief({ signal: topSignal })
      );
      return NextResponse.json({ type, text, signal: topSignal, source: snapshot.source, generatedAt: Date.now() });
    }

    if (type === "asset") {
      const protocol = snapshot.protocols.find((p) => p.slug === slug);
      const signal = signals.find((s) => s.slug === slug);
      if (!protocol || !signal) {
        return NextResponse.json({ error: "not_found", message: `Unknown protocol slug: ${slug}` }, { status: 404 });
      }
      const { value: sections } = await cached(`brief:asset:${slug}`, BRIEF_TTL_MS, () =>
        generateAssetBrief({ protocol, signal })
      );
      return NextResponse.json({ type, slug, sections, source: snapshot.source, generatedAt: Date.now() });
    }

    return NextResponse.json({ error: "bad_request", message: "type must be ecosystem | signal | asset" }, { status: 400 });
  } catch (err) {
    const message = err?.code === "ALL_PROVIDERS_DOWN" ? err.message : formatDeepSeekError(err);
    return NextResponse.json({ error: "agent_call_failed", message }, { status: 502 });
  }
}
