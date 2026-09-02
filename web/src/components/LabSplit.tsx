"use client";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Terminal } from "./Terminal";
import { ChevronDown, ChevronUp, PanelBottomOpen, TerminalSquare, X } from "lucide-react";

const BAR_H = 44; // px — the docked toolbar's own height, collapsed or not
const MIN_H = 160, MAX_H_VH = 0.8, DEFAULT_H = 400;

// Hands-on lessons: content full-width, with a live lab shell docked to the
// bottom of the viewport (like an editor's integrated terminal) — collapsible
// to just its toolbar, drag-resizable in height, never squeezing the content
// column, and offset past the (also resizable) lessons sidebar.
export function LabSplit({ slug, children }: { children: ReactNode; slug?: string }) {
  // Closed by default on every lesson, every time — "Run" shows output inline
  // under each block now, so the shell is opt-in, for readers who want to
  // customize a command or work interactively rather than run it as-is.
  const [show, setShow] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [height, setHeight] = useState(DEFAULT_H);
  // Spans the content area only (not the lessons sidebar) — mirrors
  // LearnShell's own sidebar open/width state, broadcast via oclaw:sidebar
  // since they're siblings with no shared store.
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(304);
  const dragging = useRef(false);

  useEffect(() => {
    const onStart = () => { setShow(true); setMinimized(false); };
    window.addEventListener("oclaw:start-shell", onStart);
    return () => window.removeEventListener("oclaw:start-shell", onStart);
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem("oclaw:lesson-sidebar-open");
    if (saved === "false") setSidebarOpen(false);
    const savedW = Number(window.localStorage.getItem("oclaw:lesson-sidebar-width"));
    if (Number.isFinite(savedW) && savedW > 0) setSidebarWidth(savedW);
    const savedH = Number(window.localStorage.getItem("oclaw:shell-height"));
    if (Number.isFinite(savedH) && savedH >= MIN_H) setHeight(savedH);
    const onSidebar = (e: Event) => {
      const { open, width } = (e as CustomEvent<{ open: boolean; width: number }>).detail;
      setSidebarOpen(open);
      setSidebarWidth(width);
    };
    window.addEventListener("oclaw:sidebar", onSidebar);
    return () => window.removeEventListener("oclaw:sidebar", onSidebar);
  }, []);

  function startDrag(e: React.MouseEvent) {
    e.preventDefault();
    dragging.current = true;
    const move = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const maxH = window.innerHeight * MAX_H_VH;
      setHeight(Math.min(maxH, Math.max(MIN_H, window.innerHeight - ev.clientY - BAR_H)));
    };
    const up = () => {
      dragging.current = false;
      document.body.style.cursor = "";
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      setHeight((h) => { window.localStorage.setItem("oclaw:shell-height", String(h)); return h; });
    };
    document.body.style.cursor = "row-resize";
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }

  return (
    <>
      {/* Reserve space at the bottom of the page so the fixed dock never covers
          the tail of the content — height matches whatever the dock is showing. */}
      <div
        className="prose max-w-none xl:max-w-6xl"
        style={{ paddingBottom: show ? (minimized ? BAR_H : height + BAR_H) : 0 }}
      >
        {children}
      </div>

      {!show && (
        <button
          onClick={() => setShow(true)}
          className="fixed bottom-4 right-4 z-40 rounded-lg border border-[var(--color-nv-dim)] bg-[var(--color-panel)] px-4 py-2 text-sm font-semibold text-[var(--color-nv-bright)] shadow-[0_8px_24px_rgba(0,0,0,0.22)] transition hover:bg-[var(--color-bg-2)]"
        >
          <span className="inline-flex items-center gap-2"><PanelBottomOpen size={15} /> Show shell</span>
        </button>
      )}

      {show && (
        <div
          className={`fixed bottom-0 right-0 left-0 z-40 border-t border-[var(--color-line)] bg-[var(--color-bg)] shadow-[0_-8px_24px_rgba(0,0,0,0.18)] ${sidebarOpen ? "lg:left-[var(--dock-left)]" : ""}`}
          style={{ "--dock-left": `${sidebarWidth}px` } as CSSProperties}
        >
          {!minimized && (
            <div
              onMouseDown={startDrag}
              className="flex h-1.5 cursor-row-resize items-center justify-center"
              title="Drag to resize the shell"
            >
              <span className="h-px w-10 rounded-full bg-[var(--color-line-2)] transition-colors hover:bg-[var(--color-nv)]" />
            </div>
          )}
          <div className="flex items-center gap-2 px-4" style={{ height: BAR_H }}>
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
              onClick={() => setShow(false)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--color-line-2)] text-[var(--color-fg-mut)] transition hover:bg-[var(--color-bg-2)] hover:text-[var(--color-fg)]"
              title="Close shell"
            >
              <X size={15} />
            </button>
          </div>
          {!minimized && (
            <div className="px-4 pb-3" style={{ height }}>
              <Terminal title={slug ? `lab · ${slug}` : "lab shell"} fill autoStart />
            </div>
          )}
        </div>
      )}
    </>
  );
}
