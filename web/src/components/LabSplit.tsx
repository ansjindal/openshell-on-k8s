"use client";
import { useEffect, useState, type ReactNode } from "react";
import { Terminal } from "./Terminal";
import { ChevronDown, ChevronUp, PanelBottomOpen, TerminalSquare, X } from "lucide-react";

const EXPANDED_H = "min(44vh, 440px)";
const BAR_H = 44; // px — the docked toolbar's own height, collapsed or not

// Hands-on lessons: content full-width, with a live lab shell docked to the
// bottom of the viewport (like an editor's integrated terminal) — collapsible
// to just its toolbar, never squeezing the content column.
export function LabSplit({ slug, children }: { children: ReactNode; slug?: string }) {
  // Hidden by default — the shell appears only when the reader runs a command
  // (Run-in-shell) or explicitly opens it. An explicit open/close is remembered;
  // an auto-open from a command is transient (next page starts hidden again).
  const [show, setShow] = useState(false);
  const [minimized, setMinimized] = useState(false);

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
    const onStart = () => { setShow(true); setMinimized(false); };
    window.addEventListener("oclaw:start-shell", onStart);
    return () => window.removeEventListener("oclaw:start-shell", onStart);
  }, []);

  return (
    <>
      {/* Reserve space at the bottom of the page so the fixed dock never covers
          the tail of the content — height matches whatever the dock is showing. */}
      <div
        className="prose max-w-none xl:max-w-6xl"
        style={{ paddingBottom: show ? (minimized ? BAR_H : `calc(${EXPANDED_H} + ${BAR_H}px)`) : 0 }}
      >
        {children}
      </div>

      {!show && (
        <button
          onClick={() => setShowManual(true)}
          className="fixed bottom-4 right-4 z-40 rounded-lg border border-[var(--color-nv-dim)] bg-[var(--color-panel)] px-4 py-2 text-sm font-semibold text-[var(--color-nv-bright)] shadow-[0_8px_24px_rgba(0,0,0,0.22)] transition hover:bg-[var(--color-bg-2)]"
        >
          <span className="inline-flex items-center gap-2"><PanelBottomOpen size={15} /> Show shell</span>
        </button>
      )}

      {show && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-line)] bg-[var(--color-bg)] shadow-[0_-8px_24px_rgba(0,0,0,0.18)]">
          <div className="mx-auto flex max-w-6xl items-center gap-2 px-4" style={{ height: BAR_H }}>
            <TerminalSquare size={15} className="text-[var(--color-nv-bright)]" />
            <span className="truncate text-xs font-semibold text-[var(--color-fg-dim)]">
              Live lab shell{slug ? ` · ${slug}` : ""}
            </span>
            <button
              onClick={() => setMinimized((m) => !m)}
              className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--color-line-2)] text-[var(--color-fg-mut)] transition hover:bg-[var(--color-bg-2)] hover:text-[var(--color-fg)]"
              title={minimized ? "Expand shell" : "Minimize shell"}
            >
              {minimized ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
            <button
              onClick={() => setShowManual(false)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--color-line-2)] text-[var(--color-fg-mut)] transition hover:bg-[var(--color-bg-2)] hover:text-[var(--color-fg)]"
              title="Close shell"
            >
              <X size={15} />
            </button>
          </div>
          {!minimized && (
            <div className="mx-auto max-w-6xl px-4 pb-3" style={{ height: EXPANDED_H }}>
              <Terminal title={slug ? `lab · ${slug}` : "lab shell"} fill />
            </div>
          )}
        </div>
      )}
    </>
  );
}
