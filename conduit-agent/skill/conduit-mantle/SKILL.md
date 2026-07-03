---
name: conduit-mantle
description: Live onchain research for the Mantle Network (chain ID 5000) — real TVL, ranked protocol signals, and composability metrics pulled directly from Mantle's public RPC and DefiLlama's public API at call time. Use this whenever the user asks about Mantle DeFi protocols, TVL trends, ecosystem flow, live chain status, or wants a Mantle research brief. No API key or npm install required.
---

# Conduit: Mantle onchain research

This skill gives you real-time Mantle Network data through one self-contained
script, `scripts/conduit.mjs`. It needs only Node 18+ (built-in `fetch`) — no
`npm install`, no API key. Every number it returns comes from a live call to
Mantle's public RPC (`https://rpc.mantle.xyz`) and DefiLlama's public API,
made the moment you run it — nothing here is cached from training data or
pre-baked.

## When to use this

Reach for this skill whenever the user asks about:
- Mantle TVL, ecosystem size, or 7-day capital flow
- A specific Mantle protocol (Merchant Moe, Agni Finance, Fluxion Network,
  INIT Capital, Lendle, Mantle Index Four Fund, or any other protocol
  DefiLlama tracks on Mantle)
- Which Mantle protocols are moving unusually this week ("signals")
- Live Mantle chain status (block height, gas price)

## Commands

Run these with your bash / code-execution tool from this skill's directory:

- `node scripts/conduit.mjs snapshot` — full ecosystem snapshot: chain TVL
  and 7d delta, all 6 tracked protocols with current/7d-ago TVL, ranked
  signals (biggest moves relative to each protocol's own volatility),
  composability split (active vs. passive capital), 7d net flow, and a live
  chain heartbeat.
- `node scripts/conduit.mjs status` — just the live chain heartbeat (block
  number, block timestamp, gas price in gwei).
- `node scripts/conduit.mjs search "<name>"` — search every Mantle protocol
  DefiLlama tracks (not only the curated 6), e.g. `search "lend"`. Returns
  the top 5 matches by Mantle TVL with a DefiLlama source link each.
- `node scripts/conduit.mjs detail <defillama-slug>` — full TVL detail
  (current, 7d ago, 30d ago, source link) for any single protocol slug —
  use `search` first if you don't already know the slug.

All commands print JSON to stdout. Read it, then explain it to the user in
plain language — don't paste raw JSON back at them. Always cite the
`url` (or `rpcUrl`) field when you state a number, the same way Conduit's own
dashboard and chat agent always link claims back to their source.

## Notes

- Every call is live — there is no warm cache and no stored dataset shipped
  with this skill. If DefiLlama or the RPC endpoint is briefly unreachable,
  the command exits non-zero with `{"error": "..."}` on stdout — tell the
  user the source was unreachable rather than guessing a number.
- "Signal" ranking = |7-day % change| × (that move ÷ the protocol's own
  typical weekly swing, from its own trailing volatility). A large protocol
  drifting +1% is not a signal; a small one moving 3x its usual volatility
  is. This is a disclosed, genuine methodology, not an editorialized score.
- "Active" vs. "passive" composability follows DefiLlama's own category
  taxonomy: Dexs/Lending count as capital actively deployed to trade or
  earn; RWA counts as held/passive exposure.
