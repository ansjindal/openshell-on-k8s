"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { BookOpen, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Sidebar } from "./Sidebar";

const MIN_W = 220, MAX_W = 480, DEFAULT_W = 304;

// Full-width learn shell with a collapsible, drag-resizable lesson sidebar.
export function LearnShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(true);
  const [width, setWidth] = useState(DEFAULT_W);
  const dragging = useRef(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("oclaw:lesson-sidebar-open");
    if (saved === "false") setOpen(false);
    const savedW = Number(window.localStorage.getItem("oclaw:lesson-sidebar-width"));
    if (Number.isFinite(savedW) && savedW >= MIN_W && savedW <= MAX_W) setWidth(savedW);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("oclaw:lesson-sidebar-open", String(open));
    // LabSplit's fixed-bottom shell dock needs to know the sidebar's width to
    // avoid covering it — same-tab localStorage writes don't fire a "storage"
    // event, so broadcast explicitly.
    window.dispatchEvent(new CustomEvent("oclaw:sidebar", { detail: { open, width } }));
  }, [open, width]);

  function startDrag(e: React.MouseEvent) {
    e.preventDefault();
    dragging.current = true;
    const move = (ev: MouseEvent) => {
      if (!dragging.current) return;
      setWidth(Math.min(MAX_W, Math.max(MIN_W, ev.clientX)));
    };
    const up = () => {
      dragging.current = false;
      document.body.style.cursor = "";
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      setWidth((w) => { window.localStorage.setItem("oclaw:lesson-sidebar-width", String(w)); return w; });
    };
    document.body.style.cursor = "col-resize";
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }

  return (
    <div className="relative flex w-full">
      {open && (
        <aside
          className="hidden shrink-0 border-r border-[var(--color-line)] bg-[var(--color-bg)] lg:block"
          style={{ width }}
        >
          <div className="sticky top-14 max-h-[calc(100vh-3.5rem)] overflow-y-auto px-4 py-4">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-fg-mut)]">
                <BookOpen size={14} className="text-[var(--color-nv-bright)]" />
                <span>Lessons</span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--color-line-2)] text-[var(--color-fg-mut)] transition hover:bg-[var(--color-panel)] hover:text-[var(--color-fg)]"
                title="Hide lessons"
              >
                <PanelLeftClose size={15} />
              </button>
            </div>
            <Sidebar />
          </div>
        </aside>
      )}
      {open && (
        <div
          onMouseDown={startDrag}
          className="sticky top-14 z-10 hidden h-[calc(100vh-3.5rem)] w-1.5 shrink-0 cursor-col-resize items-stretch justify-center lg:flex"
          title="Drag to resize the lessons sidebar"
        >
          <span className="w-px bg-[var(--color-line)] transition-colors hover:bg-[var(--color-nv)]" />
        </div>
      )}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed left-3 top-20 z-30 hidden items-center gap-2 rounded-lg border border-[var(--color-line-2)] bg-[var(--color-panel)] px-3 py-2 text-xs font-semibold text-[var(--color-fg-dim)] shadow-[0_8px_24px_rgba(0,0,0,0.18)] transition hover:border-[var(--color-nv-dim)] hover:text-[var(--color-fg)] lg:inline-flex"
          title="Show lessons"
        >
          <PanelLeftOpen size={15} />
          Lessons
        </button>
      )}
      <main className={`min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 ${open ? "" : "xl:px-12"}`}>
        {!open && (
          <button
            onClick={() => setOpen(true)}
            className="mb-4 inline-flex items-center gap-1.5 rounded-md border border-[var(--color-line-2)] px-2.5 py-1 text-xs text-[var(--color-fg-mut)] hover:text-[var(--color-fg)] lg:hidden"
            title="Show lessons"
          >
            <PanelLeftOpen size={14} /> Lessons
          </button>
        )}
        {children}
      </main>
    </div>
  );
}
