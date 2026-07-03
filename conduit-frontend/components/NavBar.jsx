"use client";

import { useState } from "react";

export default function NavBar({ onNavigate, onOpenDashboard, onOpenChat, onOpenDocs }) {
  const [open, setOpen] = useState(false);

  function go(action) {
    action();
    setOpen(false);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-hairline bg-ink/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 lg:px-8">
        <button
          onClick={() => go(() => onNavigate("top"))}
          className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-paper"
        >
          <img src="/conduit-logo.png" alt="" width={24} height={24} className="h-6 w-6 rounded-[6px]" />
          Conduit
        </button>

        <nav className="hidden items-center gap-8 font-mono text-[13px] text-paper-dim lg:flex">
          <button onClick={() => onNavigate("ecosystem")} className="transition-colors hover:text-paper">
            Dashboard
          </button>
          <button onClick={onOpenChat} className="transition-colors hover:text-paper">
            Chat
          </button>
          <button onClick={() => onNavigate("how-it-works")} className="transition-colors hover:text-paper">
            How it works
          </button>
          <button onClick={onOpenDocs} className="transition-colors hover:text-paper">
            Docs
          </button>
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <button
            onClick={onOpenDashboard}
            className="rounded-full border border-hairline-strong px-4 py-2 text-[13px] font-medium text-paper transition-colors hover:border-paper"
          >
            Open Dashboard
          </button>
          <button
            onClick={onOpenChat}
            className="rounded-full bg-paper px-4 py-2 text-[13px] font-medium text-ink transition-opacity hover:opacity-85"
          >
            Open Chat
          </button>
        </div>

        <button
          onClick={() => setOpen((o) => !o)}
          aria-label="Toggle menu"
          aria-expanded={open}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hairline-strong text-paper lg:hidden"
        >
          <span className="relative block h-3 w-4">
            <span
              className={`absolute left-0 top-0 h-[1.5px] w-full bg-paper transition-transform ${open ? "translate-y-[6px] rotate-45" : ""}`}
            />
            <span
              className={`absolute left-0 top-1/2 h-[1.5px] w-full -translate-y-1/2 bg-paper transition-opacity ${open ? "opacity-0" : ""}`}
            />
            <span
              className={`absolute left-0 bottom-0 h-[1.5px] w-full bg-paper transition-transform ${open ? "-translate-y-[6px] -rotate-45" : ""}`}
            />
          </span>
        </button>
      </div>

      {open && (
        <div className="border-t border-hairline bg-ink px-5 py-4 lg:hidden">
          <nav className="flex flex-col gap-1 font-mono text-[14px] text-paper-dim">
            <button
              onClick={() => go(() => onNavigate("ecosystem"))}
              className="rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-ink-raised hover:text-paper"
            >
              Dashboard
            </button>
            <button
              onClick={() => go(onOpenChat)}
              className="rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-ink-raised hover:text-paper"
            >
              Chat
            </button>
            <button
              onClick={() => go(() => onNavigate("how-it-works"))}
              className="rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-ink-raised hover:text-paper"
            >
              How it works
            </button>
            <button
              onClick={() => go(onOpenDocs)}
              className="rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-ink-raised hover:text-paper"
            >
              Docs
            </button>
          </nav>

          <div className="mt-4 flex flex-col gap-2">
            <button
              onClick={() => go(onOpenDashboard)}
              className="rounded-full border border-hairline-strong px-4 py-2.5 text-center text-[13px] font-medium text-paper transition-colors hover:border-paper"
            >
              Open Dashboard
            </button>
            <button
              onClick={() => go(onOpenChat)}
              className="rounded-full bg-paper px-4 py-2.5 text-center text-[13px] font-medium text-ink transition-opacity hover:opacity-85"
            >
              Open Chat
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
