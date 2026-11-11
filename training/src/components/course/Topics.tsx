"use client";
// A long explanation, one topic at a time: a numbered list on the left, the
// chosen topic on the right (its scene and text), Back / Next between them.
//   <Topics>
//     <Topic title="Enter OpenShell" lab="/learn/build-an-agent" labLabel="1.3 Build an agent and seal it"> …mdx… </Topic>
//   </Topics>
// Topics register themselves in order (MDX children arrive as lazy
// references, so they can't be inspected); only the open one renders its
// content, so each scene loads when you reach it. #t-3 opens topic 3.
import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, FlaskConical } from "lucide-react";
import { setLessonDone } from "@/lib/progress";
import { useLesson } from "./Structure";

type Meta = { title: string; lab?: string; labLabel?: string };
const Ctx = createContext<{ register: (m: Meta) => number; active: number } | null>(null);

export function Topics({ children }: { children: ReactNode }) {
  const [metas, setMetas] = useState<Meta[]>([]);
  const [active, setActive] = useState(0);
  const order = useRef<Meta[]>([]);
  const top = useRef<HTMLDivElement>(null);
  const { slug } = useLesson();
  const register = useCallback((m: Meta) => {
    order.current.push(m);
    setMetas([...order.current]);
    return order.current.length - 1;
  }, []);
  useEffect(() => {
    const m = /^#t-(\d+)$/.exec(window.location.hash);
    if (m) setActive(Math.max(0, +m[1] - 1));
  }, []);
  const go = (i: number) => {
    const n = Math.max(0, Math.min(metas.length - 1, i));
    setActive(n);
    try { history.replaceState(null, "", `#t-${n + 1}`); } catch {}
    if (n === metas.length - 1 && slug) setLessonDone(slug, true);
    top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const cur = metas[active];
  return (
    <Ctx.Provider value={{ register, active }}>
      <div ref={top} className="not-prose my-6 grid scroll-mt-20 gap-5 lg:grid-cols-[250px_minmax(0,1fr)]">
        <nav className="lg:sticky lg:top-20 lg:self-start">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-fg-mut)]">Topics</div>
          <ol className="space-y-1.5">
            {metas.map((m, i) => (
              <li key={i}>
                <button onClick={() => go(i)}
                  className={`flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left text-[13px] transition ${i === active ? "border-[var(--color-nv)] bg-[var(--color-panel)] font-semibold text-[var(--color-fg)]" : "border-[var(--color-line)] text-[var(--color-fg-dim)] hover:text-[var(--color-fg)]"}`}>
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${i === active ? "bg-[var(--color-nv)] text-[#0b0f05]" : i < active ? "border border-[var(--color-nv-dim)] text-[var(--color-nv-bright)]" : "border border-[var(--color-line-2)] text-[var(--color-fg-mut)]"}`}>{i < active ? "✓" : i + 1}</span>
                  <span className="min-w-0 flex-1">{m.title}</span>
                  {m.lab && <FlaskConical size={12} className="shrink-0 text-[var(--color-fg-mut)]" />}
                </button>
              </li>
            ))}
          </ol>
          <p className="mt-2 flex items-center gap-1.5 text-[11.5px] text-[var(--color-fg-mut)]"><FlaskConical size={11} /> has a lab later in this module</p>
        </nav>
        <div className="min-w-0">
          {cur && (
            <div className="mb-3">
              <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-nv-bright)]">Topic {active + 1} of {metas.length}</div>
              <h2 className="mt-1 text-[22px] font-bold text-[var(--color-fg)]">{cur.title}</h2>
            </div>
          )}
          <div className="prose max-w-none">{children}</div>
          {cur?.lab && (
            <Link href={cur.lab} className="mt-4 flex items-center gap-3 rounded-lg border border-[var(--color-run-btn-line)] bg-[var(--color-run-bg)] px-4 py-3 text-[14px] transition hover:bg-[var(--color-run-btn)]">
              <FlaskConical size={16} className="text-[var(--color-nv-bright)]" />
              <span className="text-[var(--color-fg-dim)]">Try it on your VM: <b className="text-[var(--color-fg)]">{cur.labLabel}</b></span>
              <ArrowRight size={14} className="ml-auto text-[var(--color-nv-bright)]" />
            </Link>
          )}
          <div className="mt-5 flex items-center gap-2 border-t border-[var(--color-line)] pt-4">
            <button onClick={() => go(active - 1)} disabled={active === 0}
              className="inline-flex items-center gap-1 rounded-md border border-[var(--color-line-2)] px-3 py-1.5 text-[13px] text-[var(--color-fg-dim)] hover:text-[var(--color-fg)] disabled:opacity-40"><ChevronLeft size={14} /> Back</button>
            {active < metas.length - 1 && (
              <button onClick={() => go(active + 1)}
                className="ml-auto inline-flex items-center gap-1 rounded-md border border-[var(--color-run-btn-line)] bg-[var(--color-run-btn)] px-3 py-1.5 text-[13px] font-bold text-[var(--color-nv-bright)]">
                Next: {metas[active + 1]?.title} <ChevronRight size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </Ctx.Provider>
  );
}

export function Topic(props: Meta & { children: ReactNode }) {
  const ctx = useContext(Ctx);
  const [idx, setIdx] = useState(-1);
  const meta = useRef<Meta>({ title: props.title, lab: props.lab, labLabel: props.labLabel });
  useEffect(() => { if (ctx && idx < 0) setIdx(ctx.register(meta.current)); }, [ctx, idx]);
  if (!ctx || idx !== ctx.active) return null;
  return <div className="topic-body">{props.children}</div>;
}
