import type { ReactNode } from "react";

// A static reference for what a command's output should look like — captured by
// actually running it against a live cluster, not live output itself (that's what
// "Run" on the preceding code block produces). Place directly after a runnable
// fence in MDX: `<ExpectedOutput>...</ExpectedOutput>`.
export function ExpectedOutput({ children }: { children: ReactNode }) {
  return (
    <div className="-mt-4 mb-5 overflow-hidden rounded-lg border border-[var(--color-line)]">
      <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fg-mut)]">
        Expected output
      </div>
      <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words bg-[var(--color-term-bg)] px-4 pb-4 font-mono text-[12px] leading-relaxed text-[var(--color-term-fg)]">
        {children}
      </pre>
    </div>
  );
}
