"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronDown, Eraser, Home } from "lucide-react";
import { CURRICULUM } from "@/lib/curriculum";
import { clearOutputs, setLessonDone, useProgress } from "@/lib/progress";

export function Sidebar() {
  const pathname = usePathname();
  const progress = useProgress();
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const allClosed = CURRICULUM.every((m) => closed[m.id]);

  return (
    <nav className="text-[13px]" aria-label="Course">
      <div className="mb-1 px-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[var(--color-fg-mut)]">Workspace</div>
      <div className="mb-6 rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)] p-1.5">
        <Link href="/" className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 ${pathname === "/" ? "text-[var(--color-nv-bright)]" : "text-[var(--color-fg-dim)] hover:text-[var(--color-fg)]"}`}>
          <Home size={14} className="text-[var(--color-nv-bright)]" /> Overview
        </Link>
        <button onClick={clearOutputs} className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[var(--color-fg-dim)] hover:text-[var(--color-fg)]">
          <Eraser size={14} className="text-[var(--color-nv-bright)]" /> Clear outputs
        </button>
      </div>

      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[var(--color-fg-mut)]">Modules</span>
        <button
          onClick={() => setClosed(Object.fromEntries(CURRICULUM.map((m) => [m.id, !allClosed])))}
          className="text-[10.5px] text-[var(--color-fg-mut)] hover:text-[var(--color-fg)]"
        >
          {allClosed ? "expand all" : "collapse all"}
        </button>
      </div>

      {CURRICULUM.map((m) => {
        const done = m.lessons.filter((l) => progress.lessons[l.slug]).length;
        const isClosed = closed[m.id];
        return (
          <div key={m.id} className="border-b border-[var(--color-line)] py-3">
            <button onClick={() => setClosed({ ...closed, [m.id]: !isClosed })} className="flex w-full items-start gap-2 px-1 text-left">
              <span className="flex-1 text-[13.5px] font-semibold text-white">Module {m.n} · {m.title}</span>
              <span className="pt-0.5 font-mono text-[0.7rem] text-[var(--color-fg-mut)]">{done}/{m.lessons.length}</span>
              <ChevronDown size={13} className={`mt-1 text-[var(--color-fg-mut)] transition ${isClosed ? "-rotate-90" : ""}`} />
            </button>
            {!isClosed && (
              <>
                <p className="mt-1 px-1 text-[11.5px] leading-[15.5px] text-[var(--color-fg-mut)]">{m.subtitle}</p>
                <div className="mt-2 space-y-0.5">
                  {m.lessons.map((l, i) => {
                    const active = pathname === `/learn/${l.slug}`;
                    const ldone = !!progress.lessons[l.slug];
                    return (
                      <div key={l.slug} className={`flex items-center gap-2 rounded-lg py-[7px] pl-[9px] pr-2.5 font-medium ${active ? "bg-[var(--color-panel-2)]" : "hover:bg-[var(--color-panel)]"}`}>
                        <Link href={`/learn/${l.slug}`} className="flex min-w-0 flex-1 items-center gap-2">
                          <span className={`w-6 shrink-0 font-mono text-[10px] font-semibold ${active ? "text-[var(--color-nv-bright)]" : "text-[var(--color-fg-mut)]"}`}>{m.n}.{i + 1}</span>
                          <span className={`truncate ${active ? "text-[var(--color-nv-bright)]" : "text-[var(--color-fg-dim)]"}`}>{l.title}</span>
                        </Link>
                        {l.kind === "lab" && <span className="rounded border border-[var(--color-nv-dim)] px-[5px] py-px text-[9px] font-bold text-[var(--color-nv)]">LAB</span>}
                        <button
                          onClick={() => setLessonDone(l.slug, !ldone)}
                          title={ldone ? "Mark as not done" : "Mark as done"}
                          className={`h-4 w-4 shrink-0 rounded border text-[0.6rem] leading-none ${ldone ? "border-[var(--color-nv)] bg-[var(--color-nv)] text-[#0a0d07]" : "border-[var(--color-line-2)] text-transparent"}`}
                        >✓</button>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        );
      })}
    </nav>
  );
}
