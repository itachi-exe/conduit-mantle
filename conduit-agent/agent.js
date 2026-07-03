import Anthropic from "@anthropic-ai/sdk";
import { getSnapshot } from "../conduit-backend/snapshot.js";
import { rankSignals, computeComposability, computeNetFlow7d } from "../conduit-backend/signals.js";
import { getChainHeartbeat } from "../conduit-backend/mantle.js";
import { searchMantleProtocols, getProtocolDetail } from "../conduit-backend/defillama.js";
import { checkWalletSearchLimit, recordWalletSearch } from "../conduit-backend/rateLimit.js";
import { callDeepSeek, isDeepSeekConfigured } from "./deepseek.js";

// Interpretation layer. Every brief below is generated at runtime by a real
// LLM call against the live ranked signals — nothing here is a pre-written
// string. Briefs run on DeepSeek (cheap, high-frequency, no tool use
// needed — see lib/deepseek.js); the research chat further down runs on
// Claude, which is the one that actually needs real tool-calling and
// Anthropic's hosted web_search.
//
// Mantle AI Agent Skills: searched for a public SDK/API to wire in directly
// (per the brief's bonus-points integration) and found no publicly
// documented endpoint for a research-brief-writing skill as of this build
// (2026-07-02) — only an unrelated third-party "Mantle AI" product and the
// Turing Test Hackathon's Byreal Skills CLI for trading agents, neither of
// which fits this use case. `callAgentSkill()` below is the single,
// isolated call site: swap its body for the real Mantle AI Agent Skills
// request once credentials/docs exist, and nothing else in this file needs
// to change.

const MODEL = "claude-sonnet-4-5-20250929";

function getClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  return new Anthropic({ apiKey });
}

// The UI applies its own typography (italics, section labels, etc.), so a
// model that wraps its answer in *markdown emphasis* or **bold** ends up
// showing literal asterisks on screen — and models reach for em-dashes as
// a stylistic tic more than plain prose calls for. Strip both defensively
// in case the system prompt's instruction doesn't fully land.
export function cleanAgentText(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/,\s*,/g, ",")
    .trim();
}

// Briefs run on DeepSeek by default (cheap, high-frequency). If DeepSeek is
// down or misconfigured, fall back to Claude rather than surfacing an
// error — a slightly more expensive call beats a broken dashboard. Only if
// both are unavailable does this actually throw.
async function callAgentSkill({ system, prompt }) {
  try {
    const text = await callDeepSeek({ system, prompt });
    return cleanAgentText(text);
  } catch (deepSeekErr) {
    const client = getClient();
    if (!client) throw deepSeekErr;
    try {
      const message = await client.messages.create({
        model: MODEL,
        max_tokens: 500,
        system,
        messages: [{ role: "user", content: prompt }],
      });
      const text = message.content.find((block) => block.type === "text")?.text ?? "";
      return cleanAgentText(text);
    } catch {
      throw Object.assign(new Error("Agent commentary isn't available right now."), { code: "ALL_PROVIDERS_DOWN" });
    }
  }
}

const ANALYST_SYSTEM_PROMPT = `You are Conduit, an onchain research agent for the Mantle network. You write like a sharp analyst: plain English, specific numbers, no hedging filler, no "as an AI" disclaimers. You are given real, live-computed data (chain TVL, protocol TVL deltas, a composability methodology, a signal ranking) and must interpret it, not restate it. Never invent numbers that aren't in the provided data. Write plain prose only: no markdown (no asterisks, no bold, no backticks, no bullet lists) and no em-dashes or en-dashes as punctuation; use periods and commas instead. The UI applies its own typography.`;

export async function generateEcosystemBrief({ ecosystem, composability, netFlow, topSignal }) {
  const prompt = `Live Mantle ecosystem snapshot:
- Total tracked Mantle chain TVL: $${(ecosystem.totalTvl / 1e6).toFixed(1)}M (7d ago: $${(ecosystem.tvl7dAgo / 1e6).toFixed(1)}M)
- Composability (across ${composability.trackedTvl > 0 ? "tracked near-native protocols" : "N/A"}): ${composability.activePct}% in actively-deployed categories (Dex/Lending), ${composability.idlePct}% in passive/held categories (RWA)
- Net capital flow across tracked protocols (7d): ${netFlow.direction === "in" ? "+" : "-"}$${(Math.abs(netFlow.value) / 1e6).toFixed(2)}M
- Top-ranked signal this week: ${topSignal.name} (${topSignal.category}), ${(topSignal.pctChange7d * 100).toFixed(1)}% 7d TVL change, unusualness score ${topSignal.unusualness}x its typical weekly move

Write a 2-3 sentence "Agent Brief" interpreting what's actually happening — the story behind these numbers, not a restatement of them.`;

  return callAgentSkill({ system: ANALYST_SYSTEM_PROMPT, prompt });
}

export async function generateSignalBrief({ signal }) {
  const prompt = `The single most significant signal detected this week:
- Protocol: ${signal.name} (${signal.category})
- 7d TVL change: ${(signal.pctChange7d * 100).toFixed(1)}% (${signal.usdChange7d >= 0 ? "+" : ""}$${(signal.usdChange7d / 1e6).toFixed(2)}M)
- Unusualness: ${signal.unusualness}x this protocol's typical weekly move
- Significance score: ${signal.significance}

Write exactly ONE sentence of sharp, specific interpretation of why this move stands out, suitable for display in italics under a big number. Do not restate the numbers, interpret them.`;

  return callAgentSkill({ system: ANALYST_SYSTEM_PROMPT, prompt });
}

export async function generateAssetBrief({ protocol, signal }) {
  const prompt = `Protocol detail for the asset view:
- Name: ${protocol.name} (${protocol.ticker}), category: ${protocol.category}
- Current Mantle TVL: $${(protocol.tvl / 1e6).toFixed(2)}M
- 7d ago: $${(protocol.tvl7dAgo / 1e6).toFixed(2)}M (${(signal.pctChange7d * 100).toFixed(1)}% change)
- 30d ago: $${(protocol.tvl30dAgo / 1e6).toFixed(2)}M
- Unusualness vs its own typical weekly move: ${signal.unusualness}x
- Significance rank score: ${signal.significance}

Respond with exactly three lines, each starting with the exact label shown, no markdown, no extra commentary:
WHATS_HAPPENING: <one sentence, specific to the numbers above>
WHY_IT_MATTERS: <one sentence, the "so what" for a Mantle researcher>
WHAT_TO_WATCH: <one sentence, a concrete, falsifiable thing to check next week>`;

  const raw = await callAgentSkill({ system: ANALYST_SYSTEM_PROMPT, prompt });
  const pick = (label) => {
    const match = raw.match(new RegExp(`${label}:\\s*(.+)`));
    return match ? match[1].trim() : null;
  };

  return {
    whatsHappening: pick("WHATS_HAPPENING") ?? raw,
    whyItMatters: pick("WHY_IT_MATTERS") ?? "",
    whatToWatch: pick("WHAT_TO_WATCH") ?? "",
  };
}

// Claude-specific — gates the research chat (/api/chat), which is the
// piece that actually needs tool-calling + web_search. Brief generation
// runs on DeepSeek; see isDeepSeekConfigured in lib/deepseek.js for that.
export function isClaudeConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

// Deterministic label for a chat turn — matched against the real tracked
// protocol registry rather than asked of the LLM, so it can't drift from
// what the answer is actually grounded in and doesn't depend on the model
// following a formatting instruction.
export function pickResearchLabel(question, protocols) {
  const q = (question ?? "").toLowerCase();
  for (const protocol of protocols) {
    if (q.includes(protocol.name.toLowerCase()) || q.includes(protocol.ticker.toLowerCase())) {
      return protocol.name;
    }
  }
  if (/\bsignal\b|top mover|biggest (change|move)|most significant/.test(q)) return "Signal";
  if (/composab|active.*idle|idle.*active/.test(q)) return "Composability";
  if (/\bflow\b|inflow|outflow|capital/.test(q)) return "Capital Flow";
  if (/\btvl\b|ecosystem|total value|mantle overall/.test(q)) return "Ecosystem";
  return "General Research";
}

// Formats the full live dataset into the system prompt so chat answers are
// grounded in the same numbers the dashboard shows — not a fresh LLM guess.
export function buildResearchContext({ ecosystem, protocols, signals, composability, netFlow }) {
  const protocolLines = protocols
    .map((protocol) => {
      const signal = signals.find((s) => s.slug === protocol.slug);
      return `- ${protocol.name} (${protocol.ticker}, ${protocol.category}): TVL $${(protocol.tvl / 1e6).toFixed(2)}M, 7d change ${
        signal ? (signal.pctChange7d * 100).toFixed(1) : "?"
      }%, ${protocol.activeCategory ? "actively-deployed" : "passive/held"} category, unusualness ${signal?.unusualness ?? "?"}x its typical weekly move`;
    })
    .join("\n");

  const signalLines = signals
    .map((s, i) => `${i + 1}. ${s.name}: ${(s.pctChange7d * 100).toFixed(1)}% (7d), significance score ${s.significance}`)
    .join("\n");

  return `LIVE MANTLE DATA (fetched this request from Mantle RPC + DefiLlama):

Ecosystem:
- Total Mantle chain TVL: $${(ecosystem.totalTvl / 1e6).toFixed(1)}M (7d ago: $${(ecosystem.tvl7dAgo / 1e6).toFixed(1)}M)
- Composability across tracked protocols: ${composability.activePct}% active / ${composability.idlePct}% idle
- Net capital flow (7d, tracked protocols): ${netFlow.direction === "in" ? "+" : "-"}$${(Math.abs(netFlow.value) / 1e6).toFixed(2)}M

Tracked protocols — this is the ONLY set of Mantle protocols you have real data for:
${protocolLines}

Signal ranking (by magnitude × unusualness, highest first):
${signalLines}`;
}

export function buildChatSystemPrompt(context, { searchAllowed = true } = {}) {
  return `You are the Conduit research agent for Mantle, talking directly with a researcher in a chat interface. This is a real research tool, not a demo — do actual work before answering.

The block below is a snapshot of live data as of the start of this conversation; it may be a few minutes stale. You also have tools:
- get_ecosystem_snapshot: pull the freshest ecosystem numbers if you need them re-confirmed.
- get_protocol_detail: real live detail for ANY Mantle protocol by DefiLlama slug, not just the 6 below.
- search_mantle_protocols: real search across every protocol DefiLlama tracks on Mantle, when asked about one not in the list below. Note its TVL may include multichain activity, not Mantle-only — say so if you cite it.
- get_mantle_chain_status: live RPC heartbeat (block number, gas price) if asked how current the data is.
${
  searchAllowed
    ? `- web_search: expensive, last-resort only. Use it ONLY if the answer is impossible without it and none of your other tools can help (e.g. a genuinely unfamiliar term with no onchain data angle at all). Never use it for anything about Mantle TVL/protocols, and never use it just to "double check" or add color — answer from your own tools and knowledge first.`
    : `- web_search: NOT available for this message — this wallet has used today's web search allowance. Do not mention this limitation to the user or apologize for it; just answer using your other tools and your own knowledge, same as always.`
}

Rules:
- Never invent numbers, protocols, or events. If you don't have real data for something, use a tool to get it, or say plainly it's outside what Conduit currently tracks.
- Default to answering directly from the live data block and your own knowledge. Only reach for a tool when you genuinely lack the specific number or fact being asked for.
- Prefer your own data tools over web_search for anything about Mantle TVL/protocols — they're the source of truth, not a website's summary of it. web_search is a last resort, not a first instinct.
- When you use web_search or a tool that returns a URL, that source is tracked automatically and appended as a "Sources" list after your answer — you don't need to format citations yourself, just write naturally and use the tools when they'd genuinely improve the answer.
- Write like a sharp analyst: direct, specific, no filler, no "as an AI" disclaimers. Keep answers to 2-5 sentences unless the question genuinely needs more.
- No markdown (no asterisks, no bold, no backticks) and no em-dashes or en-dashes as punctuation; use periods and commas instead. Plain prose only.

${buildResearchContext(context)}`;
}

// Used when Claude is unavailable for chat and the turn falls back to
// DeepSeek. No tools/web_search in this mode (those are Claude/Anthropic-
// specific), so the model answers directly from the live snapshot below
// rather than pretending it can look anything else up.
export function buildFallbackChatSystemPrompt(context) {
  return `You are the Conduit research agent for Mantle, talking directly with a researcher in a chat interface. You do not have live tools or web search available right now. Answer using ONLY the live data block below. If asked about a Mantle protocol not listed, or anything that would need a live web search, say plainly that's not available in this mode rather than guessing. Write like a sharp analyst: direct, specific, no filler, no "as an AI" disclaimers, no markdown, no em-dashes or en-dashes as punctuation. Keep answers to 2-5 sentences unless the question genuinely needs more.

${buildResearchContext(context)}`;
}

// Hard cap, not just a prompt suggestion — bounds real per-turn cost
// regardless of how the model interprets "use sparingly" wording.
const WEB_SEARCH_TOOL = { type: "web_search_20250305", name: "web_search", max_uses: 1 };

export const CHAT_TOOLS = [
  WEB_SEARCH_TOOL,
  {
    name: "get_ecosystem_snapshot",
    description:
      "Fetch the freshest live Mantle ecosystem snapshot: total tracked TVL, composability ratio, net 7d capital flow, and the full ranked signal list. Use when you need the numbers re-confirmed rather than relying on the (possibly few-minutes-stale) system prompt data.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_protocol_detail",
    description:
      "Fetch real live TVL detail for one specific Mantle protocol by its DefiLlama slug — works for any Mantle protocol, not just the 6 curated ones. Returns current/7d-ago/30d-ago TVL and a DefiLlama source URL. Use search_mantle_protocols first if you don't know the exact slug.",
    input_schema: {
      type: "object",
      properties: {
        slug: { type: "string", description: "DefiLlama protocol slug, e.g. 'agni-finance'." },
      },
      required: ["slug"],
    },
  },
  {
    name: "search_mantle_protocols",
    description:
      "Real search across every protocol DefiLlama tracks on Mantle (not just the 6 curated near-native ones). Use when asked about a Mantle protocol not already in your live data. Returns name, slug, category, TVL, and a DefiLlama source URL.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Protocol name or partial name to search for." },
      },
      required: ["query"],
    },
  },
  {
    name: "get_mantle_chain_status",
    description: "Fetch the live Mantle mainnet RPC heartbeat: latest block number, block timestamp, gas price.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
];

// Executes one CLIENT tool call for real — every branch hits a live RPC or
// DefiLlama call, nothing here is a lookup table. Server tools (web_search)
// are resolved by Anthropic directly and never reach this function. Errors
// (including a real-world case: some multichain protocols' full DefiLlama
// payload is 20-30MB+ and can take upwards of a minute — see
// getProtocolMantleHistory) are caught and returned as an honest
// tool_result the model can relay, rather than throwing and killing the
// whole chat turn over one slow lookup.
export async function runTool(name, input) {
  try {
    return await runToolUnsafe(name, input);
  } catch (err) {
    return { error: `Tool "${name}" failed: ${String(err?.message ?? err)}` };
  }
}

async function runToolUnsafe(name, input) {
  switch (name) {
    case "get_ecosystem_snapshot": {
      const snapshot = await getSnapshot();
      const signals = rankSignals(snapshot.protocols);
      const composability = computeComposability(snapshot.protocols);
      const netFlow = computeNetFlow7d(snapshot.protocols);
      return {
        totalTvlUsd: snapshot.ecosystem.totalTvl,
        totalTvl7dAgoUsd: snapshot.ecosystem.tvl7dAgo,
        composabilityActivePct: composability.activePct,
        composabilityIdlePct: composability.idlePct,
        netFlow7dUsd: netFlow.value,
        signals: signals.map((s) => ({ name: s.name, slug: s.slug, pctChange7d: s.pctChange7d, significance: s.significance })),
        dataSource: snapshot.source,
      };
    }
    case "get_protocol_detail": {
      const detail = await getProtocolDetail(input?.slug);
      if (!detail) {
        return { error: `No Mantle TVL history found for slug "${input?.slug}". Try search_mantle_protocols first.` };
      }
      return detail;
    }
    case "search_mantle_protocols": {
      const results = await searchMantleProtocols(input?.query ?? "");
      return {
        results,
        note: "TVL for protocols outside Conduit's 6 curated near-native set may include multichain activity, not Mantle-only.",
      };
    }
    case "get_mantle_chain_status":
      return getChainHeartbeat();
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

// Real streaming call with tools — returns the Anthropic SDK's MessageStream
// so the caller can pipe `text` events straight to its own output (an HTTP
// stream, a terminal, anything), and inspect tool_use/server_tool_use
// blocks for the agentic loop.
export function createChatStream({ system, messages, tools = CHAT_TOOLS }) {
  const client = getClient();
  if (!client) {
    throw Object.assign(new Error("ANTHROPIC_API_KEY not configured"), { code: "NO_LLM_KEY" });
  }
  return client.messages.stream({
    model: MODEL,
    max_tokens: 1024,
    system,
    messages,
    tools,
  });
}

const MAX_TOOL_ROUNDS = 4;

function describeToolCall(name, input) {
  switch (name) {
    case "get_ecosystem_snapshot":
      return "Pulling the freshest ecosystem snapshot…";
    case "get_protocol_detail":
      return `Fetching live TVL data for "${input?.slug ?? "protocol"}"…`;
    case "search_mantle_protocols":
      return `Searching Mantle protocols for "${input?.query ?? ""}"…`;
    case "get_mantle_chain_status":
      return "Checking the live Mantle chain status…";
    default:
      return `Running ${name}…`;
  }
}

function collectSourcesFromToolResult(result, sources) {
  if (!result) return;
  if (result.url) sources.set(result.url, result.name ?? result.slug ?? result.url);
  if (Array.isArray(result.results)) {
    for (const r of result.results) {
      if (r.url) sources.set(r.url, r.name ?? r.slug ?? r.url);
    }
  }
}

// Claude reaches for em-dashes as a stylistic tic despite the system
// prompt's instruction not to. Unlike a brief (one whole response, cleaned
// in one pass by cleanAgentText), this streams token by token, so the fix
// has to be per-chunk. A single-character swap is safe to do per-chunk (no
// risk of splitting a multi-char pattern across chunk boundaries the way
// markdown stripping would be).
function stripDashesFromChunk(delta) {
  return delta.replace(/—|–/g, ",");
}

// The shared chat engine — one real agentic turn (tool-use loop, Claude
// primary / DeepSeek fallback), used by both /api/chat (HTTP streaming) and
// the CLI (terminal stdout). `onChunk` receives every piece of output text
// exactly once, in order: tool/search status lines, the answer itself, and
// a trailing Sources list, so callers can just pipe it to whatever output
// they have — a Response stream, process.stdout, anything.
export async function runChatTurn({ conversation, context, onChunk, streamRef, wallet }) {
  const searchAllowed = wallet ? checkWalletSearchLimit(wallet).allowed : true;
  const tools = searchAllowed ? CHAT_TOOLS : CHAT_TOOLS.filter((t) => t.name !== "web_search");
  const system = buildChatSystemPrompt(context, { searchAllowed });
  const sources = new Map();
  let bytesSent = false;
  let searchUsedThisTurn = false;

  const emit = (text) => {
    if (!text) return;
    bytesSent = true;
    onChunk(text);
  };

  async function runDeepSeekFallback() {
    const text = await callDeepSeek({
      system: buildFallbackChatSystemPrompt(context),
      messages: conversation,
      maxTokens: 700,
    });
    emit(cleanAgentText(text));
    emit("\n\nℹ Couldn't search the web or run extra lookups for this one.");
  }

  try {
    if (!isClaudeConfigured()) {
      await runDeepSeekFallback();
      return;
    }

    let currentConversation = conversation;

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const stream = createChatStream({ system, messages: currentConversation, tools });
      if (streamRef) streamRef.current = stream;

      stream.on("text", (delta) => emit(stripDashesFromChunk(delta)));
      stream.on("contentBlock", (block) => {
        if (block.type === "server_tool_use" && block.name === "web_search") {
          if (wallet && !searchUsedThisTurn) {
            searchUsedThisTurn = true;
            recordWalletSearch(wallet);
          }
          emit(`\n\n🔍 Searching the web: "${block.input?.query ?? ""}"\n\n`);
        } else if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
          for (const result of block.content) {
            if (result.url) sources.set(result.url, result.title || result.url);
          }
        } else if (block.type === "tool_use") {
          emit(`\n\n🛠 ${describeToolCall(block.name, block.input)}\n\n`);
        }
      });

      const finalMessage = await stream.finalMessage();

      if (finalMessage.stop_reason !== "tool_use") break;

      const toolUseBlocks = finalMessage.content.filter((b) => b.type === "tool_use");
      if (toolUseBlocks.length === 0) break;

      currentConversation = [...currentConversation, { role: "assistant", content: finalMessage.content }];

      const toolResults = await Promise.all(
        toolUseBlocks.map(async (block) => {
          const result = await runTool(block.name, block.input);
          collectSourcesFromToolResult(result, sources);
          return { type: "tool_result", tool_use_id: block.id, content: JSON.stringify(result) };
        })
      );

      currentConversation = [...currentConversation, { role: "user", content: toolResults }];
    }

    if (sources.size > 0) {
      emit("\n\n**Sources:**\n");
      for (const [url, title] of sources) {
        emit(`- [${title}](${url})\n`);
      }
    }
  } catch {
    // Claude failed mid-request. If nothing has reached the caller yet for
    // this turn, it's safe to retry the whole thing on DeepSeek instead of
    // showing an error. If partial content already went out, restarting
    // would look like two conflicting answers, so fall through to a plain
    // note instead of pretending.
    if (!bytesSent && isDeepSeekConfigured()) {
      try {
        await runDeepSeekFallback();
        return;
      } catch {
        // both providers failed this turn — fall through to the note below
      }
    }
    emit(
      bytesSent
        ? "\n\nℹ The rest of this answer could not be completed."
        : "ℹ Conduit's chat agent is not reachable right now."
    );
  }
}
