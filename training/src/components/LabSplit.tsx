"use client";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Terminal } from "./Terminal";

const BAR_H = 36; // px: the shell's own bar, shown even when minimized
const MIN_H = 140, MAX_H_VH = 0.8, DEFAULT_H = 380;

// The cluster shell, docked at the bottom of the content column as in the
// course template: always there, drag its top edge to resize, ▁ to minimize
// to its bar, ⟳ to reconnect. Offset past the (resizable) lessons sidebar.
export function LabSplit({ children }: { children: ReactNode; slug?: string }) {
  const [minimized, setMinimized] = useState(false);
  const [height, setHeight] = useState(DEFAULT_H);
  const [status, setStatus] = useState("idle");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(304);
  const dragging = useRef(false);

  useEffect(() => {
    const onStart = () => setMinimized(false);
    const onStatus = (e: Event) => setStatus((e as CustomEvent<string>).detail);
    window.addEventListener("oclaw:start-shell", onStart);
    window.addEventListener("oclaw:shell-status", onStatus);
    return () => { window.removeEventListener("oclaw:start-shell", onStart); window.removeEventListener("oclaw:shell-status", onStatus); };
  }, []);

  useEffect(() => {
    try {
      if (window.localStorage.getItem("oclaw:lesson-sidebar-open") === "false") setSidebarOpen(false);
      const savedW = Number(window.localStorage.getItem("oclaw:lesson-sidebar-width"));
      if (Number.isFinite(savedW) && savedW > 0) setSidebarWidth(savedW);
      const savedH = Number(window.localStorage.getItem("oclaw:shell-height"));
      if (Number.isFinite(savedH) && savedH >= MIN_H) setHeight(savedH);
      if (window.localStorage.getItem("oclaw:shell-min") === "true") setMinimized(true);
    } catch {}
    const onSidebar = (e: Event) => {
      const { open, width } = (e as CustomEvent<{ open: boolean; width: number }>).detail;
      setSidebarOpen(open); setSidebarWidth(width);
    };
    window.addEventListener("oclaw:sidebar", onSidebar);
    return () => window.removeEventListener("oclaw:sidebar", onSidebar);
  }, []);

  useEffect(() => { try { window.localStorage.setItem("oclaw:shell-min", String(minimized)); } catch {} }, [minimized]);

  function startDrag(e: React.MouseEvent) {
    e.preventDefault();
    dragging.current = true;
    if (minimized) setMinimized(false);
    const move = (ev: MouseEvent) => {
      if (!dragging.current) return;
      setHeight(Math.min(window.innerHeight * MAX_H_VH, Math.max(MIN_H, window.innerHeight - ev.clientY - BAR_H)));
    };
    const up = () => {
      dragging.current = false;
      document.body.style.cursor = "";
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      setHeight((h) => { try { window.localStorage.setItem("oclaw:shell-height", String(h)); } catch {} return h; });
    };
    document.body.style.cursor = "row-resize";
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }

  const dot = status === "live" ? "var(--color-nv)" : status === "connecting" ? "#d8a03a" : status === "idle" ? "var(--color-fg-mut)" : "#e5484d";
  return (
    <>
      {/* room at the bottom so the dock never covers the end of the lesson */}
      <div style={{ paddingBottom: minimized ? BAR_H + 6 : height + BAR_H + 6 }}>{children}</div>

      <div
        className={`fixed bottom-0 left-0 right-0 z-40 border-t-2 border-[var(--color-line-2)] bg-[var(--color-ink2)] ${sidebarOpen ? "lg:left-[var(--dock-left)]" : ""}`}
        style={{ "--dock-left": `${sidebarWidth + 6}px` } as CSSProperties}
      >
        <div onMouseDown={startDrag} title="Drag to resize the shell"
          className="absolute -top-[5px] left-0 right-0 flex h-2 cursor-row-resize items-center justify-center">
          <span className="h-[3px] w-9 rounded-full bg-[var(--color-line-2)] transition-colors hover:bg-[var(--color-nv)]" />
        </div>
        <div className="flex items-center gap-2.5 border-b border-[var(--color-line)] px-4" style={{ height: BAR_H }}>
          <span className={`inline-block h-2.5 w-2.5 rounded-full ${status === "live" ? "animate-pulse" : ""}`} style={{ background: dot }} title={status} />
          <span className="text-[13px] font-semibold text-[var(--color-fg)]">Cluster shell</span>
          <span className="truncate text-[12px] text-[var(--color-fg-mut)]">lab-operator · kubectl, openshell</span>
          <button onClick={() => window.dispatchEvent(new Event("oclaw:reconnect-shell"))} title="reconnect the shell"
            className="ml-auto px-1.5 text-[13px] text-[var(--color-fg-mut)] hover:text-[var(--color-fg)]">⟳</button>
          <button onClick={() => setMinimized((m) => !m)} title="minimize / restore"
            className="px-1.5 text-[13px] text-[var(--color-fg-mut)] hover:text-[var(--color-fg)]">▁</button>
        </div>
        <div className={minimized ? "h-0 overflow-hidden" : ""} style={minimized ? undefined : { height }}>
          <Terminal title="lab shell" fill autoStart bare />
        </div>
      </div>
    </>
  );
}
