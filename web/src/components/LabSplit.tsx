"use client";
import { useEffect, useState, type ReactNode } from "react";
import { Terminal } from "./Terminal";
import { PanelRightClose, PanelRightOpen, TerminalSquare } from "lucide-react";

// Hands-on lessons: content on top, a live lab shell stacked below it — full
// width at every viewport size, so the content column never gets squeezed.
export function LabSplit({ slug, children }: { children: ReactNode; slug?: string }) {
  // Hidden by default — the shell appears only when the reader runs a command
  // (Run-in-shell) or explicitly opens it. An explicit open/close is remembered;
  // an auto-open from a command is transient (next page starts hidden again).
  const [show, setShow] = useState(false);

  // Explicit user toggle — remembered across pages.
  function setShowManual(next: boolean) {
    setShow(next);
    try { window.localStorage.setItem("oclaw:shell-open", String(next)); } catch {}
  }

  useEffect(() => {
    const savedShow = window.localStorage.getItem("oclaw:shell-open");
    if (savedShow === "true") setShow(true); // only an explicit prior open reveals it
  }, []);

  // Running a command (runInShell → oclaw:start-shell) reveals the shell so the
  // reader can see the output. This open is transient — it isn't persisted.
  useEffect(() => {
    const onStart = () => setShow(true);
    window.addEventListener("oclaw:start-shell", onStart);
    return () => window.removeEventListener("oclaw:start-shell", onStart);
  }, []);

  if (!show) {
    return (
      <div className="relative">
        <div className="prose max-w-none xl:max-w-6xl">
          {children}
        </div>
        <button onClick={() => setShowManual(true)} className="fixed bottom-4 right-4 z-30 rounded-lg border border-[var(--color-nv-dim)] bg-[var(--color-panel)] px-4 py-2 text-sm font-semibold text-[var(--color-nv-bright)] shadow-[0_8px_24px_rgba(0,0,0,0.22)] transition hover:bg-[var(--color-bg-2)]">
          <span className="inline-flex items-center gap-2"><PanelRightOpen size={15} /> Show shell</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="prose min-w-0 max-w-none xl:max-w-6xl">{children}</div>

      <div className="w-full">
        <div className="mb-2 flex items-center gap-2 rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)] px-2.5 py-2">
          <span className="inline-flex min-w-0 items-center gap-2 text-xs font-semibold text-[var(--color-fg-dim)]">
            <TerminalSquare size={15} className="text-[var(--color-nv-bright)]" />
            <span className="truncate">Live lab shell</span>
          </span>
          <button
            onClick={() => setShowManual(false)}
            className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--color-line-2)] text-[var(--color-fg-mut)] transition hover:bg-[var(--color-bg-2)] hover:text-[var(--color-fg)]"
            title="Hide shell"
          >
            <PanelRightClose size={15} />
          </button>
        </div>
        <Terminal title={slug ? `lab · ${slug}` : "lab shell"} />
      </div>
    </div>
  );
}
