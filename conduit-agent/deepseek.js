// DeepSeek handles the high-frequency, low-complexity brief generation
// (ecosystem/signal/asset summaries in lib/agent.js), no tool use, no
// search, just "turn these real numbers into a sentence." Claude stays on
// the research chat, which genuinely needs real tool-calling and
// Anthropic's hosted web_search tool. Splitting this way keeps the
// frequent, low-stakes calls ~20x cheaper without touching the one place
// that actually needs a stronger, tool-capable model.
//
// Model names: deepseek-chat/deepseek-reasoner are legacy aliases being
// deprecated 2026-07-24, using the real current names directly.

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const MODEL = "deepseek-v4-flash";

function getApiKey() {
  return process.env.DEEPSEEK_API_KEY || null;
}

export function isDeepSeekConfigured() {
  return Boolean(getApiKey());
}

export async function callDeepSeek({ system, prompt, messages, maxTokens = 500 }) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw Object.assign(new Error("DEEPSEEK_API_KEY not configured"), { code: "NO_LLM_KEY" });
  }

  const chatMessages = messages ?? [{ role: "user", content: prompt }];

  const res = await fetch(DEEPSEEK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "system", content: system }, ...chatMessages],
      max_tokens: maxTokens,
      // Briefs and fallback chat replies are short, direct answers, not
      // multi-step reasoning tasks, so skip thinking mode's extra latency
      // and token cost.
      thinking: { type: "disabled" },
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw Object.assign(new Error(`DeepSeek API request failed (${res.status}): ${detail}`), { status: res.status });
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content ?? "";
  return text.trim();
}

// Kept generic on purpose, this is user-facing (rendered directly in
// AgentBrief/SignalCard), so it never names a provider, an env var, or
// echoes the raw upstream error text.
export function formatDeepSeekError(err) {
  if (err?.status === 429) {
    return "Agent commentary is temporarily unavailable. Try again shortly.";
  }
  return "Agent commentary isn't available right now.";
}
