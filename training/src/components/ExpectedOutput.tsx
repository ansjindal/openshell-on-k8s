"use client";
import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

// What a command printed when this lesson was written, on a lab VM like yours.
// Place right after a runnable fence: <ExpectedOutput>{`…`}</ExpectedOutput>.
// Names, ages and ids differ on your VM; the shape is what to compare.
export function ExpectedOutput({ children, title }: { children: ReactNode; title?: string }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="not-prose -mt-2 mb-5 overflow-hidden rounded-lg border border-[var(--color-line)] bg-[var(--color-code-bg)]">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-3 px-4 py-2 text-left">
        <ChevronDown size={14} className={`text-[var(--color-fg-mut)] transition ${open ? "" : "-rotate-90"}`} />
        <span className="rounded border border-[var(--color-line-2)] px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-[var(--color-fg-mut)]">EXPECTED</span>
        <span className="text-sm text-[var(--color-fg-mut)]">{title ?? "As recorded on a lab VM like yours (names and ages differ)."}</span>
      </button>
      {open && (
        <pre className="m-0 max-h-72 overflow-auto whitespace-pre-wrap break-words border-t border-[var(--color-line)] bg-[var(--color-term-bg)] px-4 py-3 font-mono text-[12px] leading-relaxed text-[var(--color-term-fg)]">
          {children}
        </pre>
      )}
    </div>
  );
}
