"use client";

import { useEffect, useRef, useState } from "react";

const LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
const DAILY_MESSAGE_LIMIT = 10;
const WALLET_STORAGE_KEY = "conduit_wallet";

function shortAddress(address) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function linkify(text, keyPrefix) {
  const parts = [];
  let lastIndex = 0;
  let match;
  let i = 0;
  LINK_RE.lastIndex = 0;
  while ((match = LINK_RE.exec(text))) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    parts.push(
      <a
        key={`${keyPrefix}-link-${i++}`}
        href={match[2]}
        target="_blank"
        rel="noreferrer"
        className="text-signal underline underline-offset-2 hover:text-paper"
      >
        {match[1]}
      </a>
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

// Renders the raw stream as: muted activity lines for real tool/search
// calls (🔍/🛠), a distinct source list with real clickable links, and
// normal prose with any inline [text](url) citations linkified.
function MessageContent({ content }) {
  const lines = content.split("\n");
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (/^(🔍|🛠)/.test(line)) {
          return (
            <div key={i} className="font-mono text-[12px] italic text-paper-faint">
              {line}
            </div>
          );
        }
        if (line.startsWith("ℹ")) {
          return (
            <div key={i} className="mt-2 border-t border-hairline pt-2 font-mono text-[12px] text-paper-faint">
              {line}
            </div>
          );
        }
        if (line.trim() === "**Sources:**") {
          return (
            <div key={i} className="mt-3 font-mono text-[11px] uppercase tracking-wider text-paper-faint">
              Sources
            </div>
          );
        }
        const sourceMatch = line.match(/^-\s*\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/);
        if (sourceMatch) {
          return (
            <a
              key={i}
              href={sourceMatch[2]}
              target="_blank"
              rel="noreferrer"
              className="block truncate text-[13px] text-signal underline underline-offset-2 hover:text-paper"
            >
              {sourceMatch[1]}
            </a>
          );
        }
        if (line.trim() === "") return <div key={i} className="h-1.5" />;
        return (
          <p key={i} className="text-[14px] leading-relaxed">
            {linkify(line, i)}
          </p>
        );
      })}
    </div>
  );
}

function Bubble({ message }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`${isUser ? "max-w-[70%] items-end" : "max-w-[85%] items-start"} flex flex-col gap-1.5`}>
        {!isUser && message.label && (
          <span className="rounded-full border border-hairline-strong px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-signal">
            {message.label}
          </span>
        )}
        <div
          className={`rounded-2xl px-4 py-3 ${
            isUser ? "bg-paper text-ink" : "border border-hairline bg-panel text-paper-dim"
          }`}
        >
          {message.content ? (
            <MessageContent content={message.content} />
          ) : message.streaming ? (
            <span className="inline-flex items-center gap-2 font-mono text-[12px] italic text-paper-faint">
              <span className="inline-flex gap-1">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-paper-faint" style={{ animationDelay: "0ms" }} />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-paper-faint" style={{ animationDelay: "150ms" }} />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-paper-faint" style={{ animationDelay: "300ms" }} />
              </span>
              Thinking…
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function ResearchChat({ onBack, suggestedPrompts }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [wallet, setWallet] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [walletError, setWalletError] = useState(null);
  const [remaining, setRemaining] = useState(null);
  const [limitReached, setLimitReached] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    const saved = window.localStorage.getItem(WALLET_STORAGE_KEY);
    if (saved) setWallet(saved);
  }, []);

  useEffect(() => {
    if (!window.ethereum) return;
    const handleAccountsChanged = (accounts) => {
      if (accounts.length === 0) {
        setWallet(null);
        window.localStorage.removeItem(WALLET_STORAGE_KEY);
      } else {
        setWallet(accounts[0]);
        window.localStorage.setItem(WALLET_STORAGE_KEY, accounts[0]);
      }
    };
    window.ethereum.on?.("accountsChanged", handleAccountsChanged);
    return () => window.ethereum.removeListener?.("accountsChanged", handleAccountsChanged);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function connectWallet() {
    if (!window.ethereum) {
      setWalletError("No wallet extension found in this browser.");
      return;
    }
    setConnecting(true);
    setWalletError(null);
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      setWallet(accounts[0]);
      window.localStorage.setItem(WALLET_STORAGE_KEY, accounts[0]);
    } catch {
      setWalletError("Wallet connection was cancelled or failed.");
    } finally {
      setConnecting(false);
    }
  }

  function disconnectWallet() {
    setWallet(null);
    setRemaining(null);
    setLimitReached(false);
    window.localStorage.removeItem(WALLET_STORAGE_KEY);
  }

  async function sendMessage(text) {
    const question = text.trim();
    if (!question || isStreaming || !wallet || limitReached) return;

    const history = [...messages, { role: "user", content: question }];
    setMessages([...history, { role: "assistant", content: "", streaming: true }]);
    setInput("");
    setIsStreaming(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, wallet }),
      });

      if (!res.ok || !res.body) {
        if (res.status === 429) setLimitReached(true);
        const errJson = await res.json().catch(() => null);
        const errMessage = errJson?.message || `Chat request failed (${res.status}).`;
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", content: `ℹ ${errMessage}` };
          return next;
        });
        return;
      }

      const remainingHeader = res.headers.get("X-Messages-Remaining");
      if (remainingHeader !== null) {
        const remainingCount = Number(remainingHeader);
        setRemaining(remainingCount);
        if (remainingCount <= 0) setLimitReached(true);
      }

      const label = decodeURIComponent(res.headers.get("X-Research-Label") ?? "General Research");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", content: accumulated, label, streaming: true };
          return next;
        });
      }

      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: "assistant", content: accumulated, label, streaming: false };
        return next;
      });
    } catch (err) {
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: "assistant", content: `ℹ ${String(err?.message ?? err)}` };
        return next;
      });
    } finally {
      setIsStreaming(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    sendMessage(input);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  return (
    <section className="mx-auto flex h-[calc(100dvh-64px)] max-w-4xl flex-col px-5 py-5 lg:px-8 lg:py-8">
      <button
        onClick={onBack}
        className="mb-4 flex items-center gap-2 self-start font-mono text-[13px] text-paper-faint transition-colors hover:text-paper"
      >
        ← Back to dashboard
      </button>

      <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-hairline bg-panel px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-wider text-paper-faint">Conduit Research Agent</div>
          <div className="mt-1 text-[13px] text-paper-dim">
            Real tool calls against live Mantle data and the web. Watch it search, then check its sources.
          </div>
        </div>
        {wallet ? (
          <div className="flex items-center gap-2">
            {remaining !== null && (
              <span className="font-mono text-[11px] text-paper-faint">{remaining}/{DAILY_MESSAGE_LIMIT} today</span>
            )}
            <button
              onClick={disconnectWallet}
              className="flex items-center gap-1.5 rounded-full border border-hairline-strong px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-paper-dim transition-colors hover:border-paper hover:text-paper"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-signal" />
              {shortAddress(wallet)}
            </button>
          </div>
        ) : (
          <button
            onClick={connectWallet}
            disabled={connecting}
            className="rounded-full bg-paper px-4 py-2 text-[13px] font-medium text-ink transition-opacity hover:opacity-85 disabled:opacity-60"
          >
            {connecting ? "Connecting…" : "Connect Wallet"}
          </button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto rounded-2xl border border-hairline bg-ink-raised p-5">
        {!wallet && (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <p className="max-w-sm text-[14px] text-paper-faint">
              Connect a wallet to chat with the research agent. Each wallet gets {DAILY_MESSAGE_LIMIT} messages a
              day.
            </p>
            <button
              onClick={connectWallet}
              disabled={connecting}
              className="rounded-full bg-paper px-5 py-2.5 text-[13px] font-medium text-ink transition-opacity hover:opacity-85 disabled:opacity-60"
            >
              {connecting ? "Connecting…" : "Connect Wallet"}
            </button>
            {walletError && <p className="max-w-sm text-[13px] text-danger">{walletError}</p>}
          </div>
        )}
        {wallet && messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <p className="max-w-sm text-[14px] text-paper-faint">
              Ask about any of the 11 tracked Mantle protocols, another Mantle protocol entirely, the composability
              ratio, or this week's ranked signal. The agent will fetch and cite what it needs.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {suggestedPrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  className="rounded-full border border-hairline-strong px-3 py-1.5 font-mono text-[12px] text-paper-dim transition-colors hover:border-signal hover:text-signal"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((message, i) => (
          <Bubble key={i} message={message} />
        ))}
      </div>

      <form onSubmit={handleSubmit} className="mt-4 flex items-end gap-3">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            !wallet
              ? "Connect your wallet to chat…"
              : limitReached
                ? "Today's message limit reached…"
                : "Ask about Mantle protocols…"
          }
          rows={1}
          disabled={isStreaming || !wallet || limitReached}
          className="max-h-32 flex-1 resize-none rounded-2xl border border-hairline bg-panel px-4 py-3 text-[13px] text-paper placeholder:text-paper-faint focus:border-hairline-strong focus:outline-none disabled:opacity-60 lg:text-[14px]"
        />
        <button
          type="submit"
          disabled={isStreaming || !input.trim() || !wallet || limitReached}
          className="rounded-full bg-paper px-5 py-3 text-[13px] font-medium text-ink transition-opacity hover:opacity-85 disabled:opacity-40"
        >
          {isStreaming ? "…" : "Send"}
        </button>
      </form>
    </section>
  );
}
