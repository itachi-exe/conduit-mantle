# Conduit

The onchain research agent for Mantle, built for Track 2, Mantle Research
Challenge. Reads live Mantle chain data, ranks the most significant weekly
shifts, and has an LLM write the interpretation at request time. Nothing on
the default path is hardcoded or pre-written.

## Run it

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. The dashboard renders real Mantle data on
first load with zero configuration, no API key required for that part.

To also see live agent output (not the honest "agent unavailable" state),
copy `.env.example` to `.env.local` and fill in real keys, see that file
for which key powers what and why they're split across two providers.

## Architecture

Four layers, in `conduit-frontend/`, `conduit-backend/`, `conduit-agent/` + `app/api/`:

1. **Data layer** (`conduit-backend/mantle.js`, `conduit-backend/defillama.js`, `conduit-backend/snapshot.js`), `conduit-backend/mantle.js` reads Mantle mainnet directly over RPC via `viem`
   (chain ID 5000, public endpoint, no key needed): latest block number,
   timestamp, gas price. `conduit-backend/defillama.js` pulls real chain-level Mantle
   TVL history and, for each protocol in `conduit-backend/protocols.js`, its real
   **per-chain** historical TVL, not DefiLlama's top-level `change_7d`,
   which is computed across a protocol's entire multichain footprint and
   would misrepresent Mantle-specific health for something like a
   multichain lending market. `conduit-backend/snapshot.js` composes these into one
   schema, cached 60s in-memory (`conduit-backend/cache.js`) so repeat loads are fast
   without hammering the upstream APIs on every request.

   Tracked protocols are eleven real, near-native (≤2 chain) Mantle protocols
   verified against the DefiLlama API before being hardcoded into the
   registry: Merchant Moe, Agni Finance, Fluxion Network, FusionX V3 (Dexs),
   INIT Capital, Lendle (Lending), Mantle Index Four Fund, Solv RWA (RWA),
   Circuit Protocol (Yield Aggregator), Aurelius (CDP), and Puff Penthouse
   (Farm).

2. **Signal layer** (`conduit-backend/signals.js`), for each protocol, computes the 7d
   TVL delta and scores it by `magnitude × unusualness`, where unusualness
   is that delta measured against the protocol's *own* recent daily
   volatility (stdev of daily % returns from its live 90-day series, scaled
   to a weekly window). A big protocol drifting 1% doesn't rank above a
   small protocol swinging 3x its typical week. Also computes a
   composability ratio (active-category TVL vs. passive-category TVL,
   using DefiLlama's own category taxonomy, Dexs/Lending count as
   actively deployed, RWA counts as passively held) and net 7d capital flow
   across the tracked set.

3. **Agent layer** (`conduit-agent/agent.js`, `conduit-agent/deepseek.js`,
   `app/api/brief/route.js`), takes the live ranked signals and calls
   **DeepSeek** (`deepseek-v4-flash`, non-thinking mode, see `conduit-agent/deepseek.js`)
   at request time to write the brief. Three brief types: ecosystem summary,
   single-sentence signal interpretation, and a 3-section per-asset brief
   (what's happening / why it matters / what to watch). If DeepSeek fails or
   `DEEPSEEK_API_KEY` is missing, it falls back to Claude rather than
   showing an error, and vice versa for chat (see below), only if *both*
   providers are unreachable does the UI show a (calm, non-alarming) note
   that nothing could be generated. Numbers themselves are never faked
   either way.

   **Why DeepSeek here and Claude for chat:** briefs are high-frequency
   (every dashboard load, every asset click) and low-complexity, no tools,
   just "turn these real numbers into a sentence." DeepSeek V4 Flash prices
   at $0.14/M input, $0.28/M output vs. Claude Sonnet's $3/$15, roughly
   20x cheaper for a job that doesn't need Claude's tool-calling. The
   research chat (below) genuinely needs that, so it stays on Claude. Model
   names `deepseek-chat`/`deepseek-reasoner` are legacy aliases being
   deprecated 2026-07-24, this uses the real current model name directly.

   **On Mantle AI Agent Skills:** the brief mentions this as a named
   integration. We looked for a public SDK/API for a research-brief-writing
   skill and didn't find one as of this build (2026-07-02), only an
   unrelated third-party "Mantle AI" product and the Turing Test
   Hackathon's Byreal Skills CLI for trading agents, neither of which fits
   this use case. `callAgentSkill()` in `conduit-agent/agent.js` is the single,
   isolated call site, swap its body for the real thing once
   credentials/docs exist, nothing else needs to change.

4. **Surface layer** (`app/page.jsx` + `conduit-frontend/components/`), a client component
   that fetches `/api/snapshot` and `/api/signal` on mount, then fires the
   agent calls once live data is in. Loading state is skeleton shimmer, not
   spinners; errors are shown inline, not swallowed.

**Chat** (`conduit-frontend/components/ResearchChat.jsx`, `app/api/chat/route.js`,
`conduit-agent/agent.js`'s `CHAT_TOOLS`/`runTool`), a real agentic research
assistant, not a single stuffed-context completion. Reachable via "Open
Chat" in the nav or the hero's live brief card. Every turn runs an actual
tool-use loop (`app/api/chat/route.js`, capped at 4 rounds):

- **web_search**, Anthropic's native hosted search tool
  (`web_search_20250305`). The model decides when to search; results come
  back with real URLs and titles, resolved server-side by Anthropic within
  the same streamed request.
- **get_ecosystem_snapshot** / **get_mantle_chain_status**, re-fetch the
  live dashboard data or RPC heartbeat on demand, for when the model wants
  the freshest read rather than what's in the system prompt.
- **search_mantle_protocols**, real search across *every* protocol
  DefiLlama tracks on Mantle, not just the 11 curated ones, so the agent can
  answer about a protocol it wasn't pre-loaded with.
- **get_protocol_detail**, real live TVL detail for any Mantle protocol by
  slug, with its DefiLlama source URL. Bounded to a 15s timeout: some
  multichain protocols' full DefiLlama payload is 20-30MB+ (Aave V3 alone
  is ~28MB / ~100s to fetch in full) since the API returns every chain's
  history, not just Mantle's slice, a timeout here fails honestly
  (`{error: ...}` returned to the model to relay) rather than hanging the
  chat turn for a minute.

Each real tool call is streamed to the client as a visible status line
(`🔍 Searching the web: "..."` / `🛠 Fetching live TVL data for "..."`)
before its result comes back, the workflow is visible, not a black box.
Every URL touched (web search results, DefiLlama source links) is collected
server-side and appended as a clickable **Sources** list at the end of the
answer. Each reply also gets a topic label (e.g. "Agni Finance",
"Composability", "Signal") determined deterministically by matching the
question against the real protocol registry, not asked of the LLM, so it
can't drift from what the answer is actually grounded in.

**Fallback:** if Claude is unavailable (missing key, rate limit, etc.) and
nothing has streamed yet for that turn, the request retries on DeepSeek
instead of erroring, a real, still-live-data-grounded answer, just without
tool-calling or web_search (DeepSeek doesn't have Anthropic's hosted search
tool, so that mode answers directly from the snapshot already known at the
start of the conversation). This is disclosed with a quiet, non-alarming
note appended to the reply, not hidden and not presented as an error. Only
if both providers are unreachable does the chat show a calm note that it
can't answer right now.

`mockData`-shaped fallback (`conduit-backend/fallbackData.js`) is used **only** if a
live snapshot fetch fails and there's no stale cache to serve instead, the
response is tagged `source: "fallback"` and the UI shows a visible banner.
Default path is always live.

## Wallet gate & rate limit

The chat requires a connected wallet before it'll send anything. It talks
directly to `window.ethereum` (any injected, EIP-1193 wallet, MetaMask,
Rabby, OKX, etc.), no WalletConnect/RainbowKit dependency: `eth_requestAccounts`
on connect, an `accountsChanged` listener to stay in sync if the user switches
accounts, and the address persisted in `localStorage` so a refresh doesn't
force a reconnect.

Each wallet address is capped at 10 chat messages per day. `POST /api/chat`
requires a `wallet` field (validated as a `0x`-prefixed 40-hex-char address)
and returns `401` without one. `conduit-backend/rateLimit.js` tracks a per-wallet,
per-UTC-day counter in memory (same single-process tradeoff as
`conduit-backend/cache.js`, resets on server restart, not shared across serverless
instances) and the route returns `429` once a wallet hits the cap for the
day; the remaining count comes back on every response via the
`X-Messages-Remaining` header and is shown live in the chat header.

This is an address-based cap, not wallet-ownership verification, there's no
signature check tying a request to the connecting wallet, so it's meant to
rate-limit a free feature, not gate anything of value.

## Terminal CLI

The same agent (`conduit-agent/agent.js`'s `runChatTurn`, real tool-calling, real
Mantle data, Claude with DeepSeek fallback), in a terminal instead of a
browser:

```bash
npx conduit-mantle
```

or, from a checkout of this repo:

```bash
npm run cli
```

`conduit-agent/cli/conduit.js` is a thin terminal wrapper around the exact same shared
engine the web chat uses, same tools, same fallback behavior, same live
Mantle RPC + DefiLlama data fetched fresh at startup. It reads
`ANTHROPIC_API_KEY`/`DEEPSEEK_API_KEY` from the environment or a
`.env.local`/`.env` file in the current directory. One known tradeoff:
since the CLI is published from the same package as the web app, `npx
conduit-mantle` installs the full Next.js/React/Recharts dependency tree
even though the CLI itself only touches `@anthropic-ai/sdk` and `viem`, heavier install than a standalone CLI package would be, not a functional
issue.

## LLM Skill

`conduit-agent/skill/conduit-mantle/` is a portable, dependency-free skill package (zipped
for download at `public/downloads/conduit-mantle-skill.zip`, linked from the
dashboard). It ports the read-only data half of the pipeline, chain
heartbeat, TVL snapshot, signal ranking, composability, protocol search/detail, into a single script, `scripts/conduit.mjs`, that needs only Node 18+ (no
`npm install`, no API key, no viem dependency, the RPC calls are raw
`eth_*` JSON-RPC over `fetch`).

Upload the zip to Claude as a Skill (or drop the folder anywhere an agent can
run a script, Claude Code, Cursor, a custom agent), and the model can call
`node scripts/conduit.mjs snapshot|status|search "<name>"|detail <slug>` on
its own mid-conversation. `SKILL.md` carries the frontmatter description and
usage instructions Claude's Skills system reads to decide when to use it.

Run `npm run skill:zip` after changing anything under `skill/` to
regenerate the downloadable archive.

## Endpoints

- `GET /api/snapshot`, raw live data: ecosystem TVL, per-protocol TVL +
  90d trend, RPC heartbeat.
- `GET /api/signal`, ranked signals, composability ratio, net flow,
  computed from the snapshot.
- `POST /api/brief`, `{ type: "ecosystem" | "signal" | "asset", slug? }`
  → calls the LLM live, returns the generated text.
- `POST /api/chat`, `{ messages: [{ role, content }, ...], wallet }` → runs
  a real agentic tool-use loop (web search + live Mantle data tools, see
  above) on Claude, falling back to a plain DeepSeek call if Claude is
  unavailable. `wallet` must be a connected `0x`-address; see "Wallet gate &
  rate limit" above. Streams the reply as plain text, with visible tool-call
  status lines and a Sources list appended. Response headers carry
  `X-Research-Label` (topic label) and `X-Messages-Remaining` (daily quota
  left for that wallet).

## Stack

Next.js 16 (App Router) + Tailwind v4 + Recharts + viem + `@anthropic-ai/sdk`
(chat) + DeepSeek REST API (briefs, plain `fetch`, no SDK dependency).
