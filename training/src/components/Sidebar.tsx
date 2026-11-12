"use client";
// The course outline, in the template's markup: Workspace links, then each
// module with its lessons (number, title, LAB tag, done tick).
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { CURRICULUM } from "@/lib/curriculum";
import { clearOutputs, setLessonDone, useProgress } from "@/lib/progress";

export function Sidebar() {
  const pathname = usePathname();
  const progress = useProgress();
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const allClosed = CURRICULUM.every((m) => closed[m.id]);

  return (
    <nav className="sidebody" aria-label="Course">
      <div className="navsec">
        <h4 className="navseclabel">Workspace</h4>
        <div className="navlinks">
          <Link href="/" className={`pg navlink${pathname === "/" ? " active" : ""}`}><span className="ni">⌂</span><span className="lbl">Overview</span></Link>
          <div className="pg navlink" onClick={clearOutputs} title="Delete saved command output on every page. Progress ticks are untouched."><span className="ni">⌫</span><span className="lbl">Clear outputs</span></div>
        </div>
      </div>
      <div className="chaptershead">
        <h4 className="navseclabel">Modules</h4>
        <span className="collapseall" onClick={() => setClosed(Object.fromEntries(CURRICULUM.map((m) => [m.id, !allClosed])))}>
          {allClosed ? "expand all" : "collapse all"}
        </span>
      </div>
      <div id="chapters">
        {CURRICULUM.map((m) => {
          const done = m.lessons.filter((l) => progress.lessons[l.slug]).length;
          const isClosed = closed[m.id];
          return (
            <div key={m.id} className="chap">
              <div className="t" onClick={() => setClosed({ ...closed, [m.id]: !isClosed })}>
                <span>Module {m.n} · {m.title}</span>
                <span className={`cnt${done === m.lessons.length ? " all" : ""}`}>{done}/{m.lessons.length}</span>
                <span className="chev">{isClosed ? "▸" : "▾"}</span>
              </div>
              {!isClosed && (
                <>
                  <div className="sub">{m.subtitle}</div>
                  {m.lessons.map((l, i) => {
                    const active = pathname === `/learn/${l.slug}`;
                    const ldone = !!progress.lessons[l.slug];
                    return (
                      <Link key={l.slug} href={`/learn/${l.slug}`} className={`pg${active ? " active" : ""}${ldone ? " done" : ""}`}>
                        <span className="pgno">{m.n}.{i + 1}</span>
                        <span className="lbl">{l.title}</span>
                        {l.kind === "lab" && <span className="labtag">LAB</span>}
                        <span className="chk" title={ldone ? "mark not complete" : "mark complete"}
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setLessonDone(l.slug, !ldone); }}>✓</span>
                      </Link>
                    );
                  })}
                </>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
