"use client";

import { useState } from "react";

export default function CopyCommand({ command }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard API can be blocked (permissions, insecure context), the
      // command is still plainly visible and selectable either way.
    }
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-hairline-strong bg-ink-raised px-5 py-3">
      <code className="overflow-x-auto whitespace-pre font-mono text-[14px] text-paper">{command}</code>
      <button
        onClick={handleCopy}
        className="shrink-0 rounded-full border border-hairline-strong px-3 py-1.5 font-mono text-[12px] text-paper-dim transition-colors hover:border-signal hover:text-signal"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
