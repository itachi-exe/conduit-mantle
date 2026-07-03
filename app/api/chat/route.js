import { getSnapshot } from "@/conduit-backend/snapshot";
import { rankSignals, computeComposability, computeNetFlow7d } from "@/conduit-backend/signals";
import { pickResearchLabel, runChatTurn, isClaudeConfigured } from "@/conduit-agent/agent";
import { isDeepSeekConfigured } from "@/conduit-agent/deepseek";
import { checkWalletLimit, recordWalletMessage } from "@/conduit-backend/rateLimit";

const MAX_HISTORY = 12;
const WALLET_RE = /^0x[a-fA-F0-9]{40}$/;

function jsonError(status, error, message) {
  return new Response(JSON.stringify({ error, message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(request) {
  if (!isClaudeConfigured() && !isDeepSeekConfigured()) {
    return jsonError(503, "agent_not_configured", "Conduit's chat agent is not reachable right now.");
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "bad_request", "Expected JSON body.");
  }

  const { messages, wallet } = body ?? {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return jsonError(400, "bad_request", "messages[] is required.");
  }
  if (typeof wallet !== "string" || !WALLET_RE.test(wallet)) {
    return jsonError(401, "wallet_required", "Connect your wallet to chat.");
  }

  const { allowed } = checkWalletLimit(wallet);
  if (!allowed) {
    return jsonError(429, "rate_limited", "You've reached today's message limit. Try again tomorrow.");
  }
  const remaining = recordWalletMessage(wallet);

  const trimmed = messages.slice(-MAX_HISTORY).map((m) => ({ role: m.role, content: m.content }));
  const lastUserMessage = [...trimmed].reverse().find((m) => m.role === "user");

  const snapshot = await getSnapshot();
  const signals = rankSignals(snapshot.protocols);
  const composability = computeComposability(snapshot.protocols);
  const netFlow = computeNetFlow7d(snapshot.protocols);

  const label = pickResearchLabel(lastUserMessage?.content, snapshot.protocols);
  const context = { ecosystem: snapshot.ecosystem, protocols: snapshot.protocols, signals, composability, netFlow };

  const encoder = new TextEncoder();
  const streamRef = { current: null };

  const stream = new ReadableStream({
    async start(controller) {
      await runChatTurn({
        conversation: trimmed,
        context,
        onChunk: (text) => controller.enqueue(encoder.encode(text)),
        streamRef,
        wallet,
      });
      controller.close();
    },
    cancel() {
      streamRef.current?.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Research-Label": encodeURIComponent(label),
      "X-Data-Source": snapshot.source,
      "X-Messages-Remaining": String(remaining),
    },
  });
}
