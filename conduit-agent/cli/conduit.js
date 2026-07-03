#!/usr/bin/env node

// Same real agent as the web chat (conduit-agent/agent.js's runChatTurn, Claude with
// live tool-calling + web_search, falling back to DeepSeek if Claude is
// unavailable), just talking to a terminal instead of a browser. No mock
// data, no canned answers: every number comes from a live Mantle RPC call
// and DefiLlama fetch made when this process starts.

import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

import { getSnapshot } from "../../conduit-backend/snapshot.js";
import { rankSignals, computeComposability, computeNetFlow7d } from "../../conduit-backend/signals.js";
import { runChatTurn, pickResearchLabel, isClaudeConfigured } from "../agent.js";
import { isDeepSeekConfigured } from "../deepseek.js";
import { formatUsd, formatPct } from "../../shared/format.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Minimal .env / .env.local loader so `npx conduit-agent` works standalone,
// without Next.js's automatic env loading. Checks the current directory
// first (so running it inside a checkout with your own .env.local works),
// then falls back to this package's own root directory (two levels up from
// conduit-agent/cli/, where package.json and .env.local actually live).
function loadDotEnv(filename) {
  for (const dir of [process.cwd(), path.join(__dirname, "..", "..")]) {
    const filePath = path.join(dir, filename);
    if (!fs.existsSync(filePath)) continue;
    for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed
        .slice(eq + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
      if (!(key in process.env)) process.env[key] = value;
    }
    return;
  }
}
loadDotEnv(".env.local");
loadDotEnv(".env");

const isTTY = Boolean(stdout.isTTY);
const color = (code, text) => (isTTY ? `\x1b[${code}m${text}\x1b[0m` : text);
const bold = (t) => color(1, t);
const dim = (t) => color(2, t);
const green = (t) => color(92, t);

async function main() {
  if (!isClaudeConfigured() && !isDeepSeekConfigured()) {
    console.error("No LLM provider configured. Set ANTHROPIC_API_KEY and/or DEEPSEEK_API_KEY, then try again.");
    console.error("See .env.example in the Conduit repo for details.");
    process.exitCode = 1;
    return;
  }

  console.log(`${bold("Conduit")} ${dim(", the onchain research agent for Mantle")}`);
  console.log(dim("Connecting to Mantle mainnet and DefiLlama..."));

  const snapshot = await getSnapshot();
  const signals = rankSignals(snapshot.protocols);
  const composability = computeComposability(snapshot.protocols);
  const netFlow = computeNetFlow7d(snapshot.protocols);
  const context = { ecosystem: snapshot.ecosystem, protocols: snapshot.protocols, signals, composability, netFlow };

  if (snapshot.heartbeat) {
    console.log(
      dim(
        `connected · block #${snapshot.heartbeat.blockNumber} · tracked TVL ${formatUsd(snapshot.ecosystem.totalTvl)} (${formatPct(
          (snapshot.ecosystem.totalTvl - snapshot.ecosystem.tvl7dAgo) / snapshot.ecosystem.tvl7dAgo,
          { signed: true }
        )} 7d) · ${composability.activePct}% active`
      )
    );
  } else {
    console.log(dim(`live sources unreachable, showing ${snapshot.source} data`));
  }
  console.log(dim('Ask about any Mantle protocol, composability, or this week\'s signal. Type "exit" to quit.\n'));

  const rl = readline.createInterface({ input: stdin, output: stdout, prompt: `${green("you ›")} ` });
  const conversation = [];

  rl.prompt();
  for await (const line of rl) {
    const question = line.trim();
    if (!question) {
      rl.prompt();
      continue;
    }
    if (["exit", "quit", ":q"].includes(question.toLowerCase())) break;

    conversation.push({ role: "user", content: question });
    const label = pickResearchLabel(question, snapshot.protocols);
    stdout.write(`\n${dim(`[${label}]`)}\n`);

    let answer = "";
    await runChatTurn({
      conversation,
      context,
      onChunk: (text) => {
        answer += text;
        stdout.write(text);
      },
    });
    stdout.write("\n\n");
    conversation.push({ role: "assistant", content: answer });

    rl.prompt();
  }

  console.log(dim("\nGoodbye."));
  rl.close();
}

main();
