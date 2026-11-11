"use client";
// Lesson structure (same template on every page):
//   <BeforeYouStart will="…" time="…" />            labs
//   <BeforeYouStart learn="…" prereq="…" start="…" /> module overviews
//   <Section n="1" title="…" goal="…">
//     <Step n="1" title="…"> prose, ```bash fences (or <Run> with several), <Output>…</Output>, prose </Step>
//   </Section>
//   <Optional title="…">…</Optional>
//   <Learned next="/learn/x" nextLabel="…"> - **Lead.** detail </Learned>
// Numbers combine with the lesson's own number: lesson 1.4, section 1, step 2 -> 1.4.1.2.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import { setStepDone, useProgress } from "@/lib/progress";

type LessonCtx = { slug: string; number: string };
const LessonContext = createContext<LessonCtx>({ slug: "", number: "" });
const SectionContext = createContext<{ id: string; register: (stepKey: string) => () => void }>({ id: "", register: () => () => {} });

export type LiveRun = { text: string; exit: number | null } | null;
export const StepContext = createContext<{ id: string; hasOutput: boolean; live: LiveRun; setLive: (r: LiveRun) => void; markOutput: () => () => void }>({
  id: "", hasOutput: false, live: null, setLive: () => {}, markOutput: () => () => {},
});

export function LessonProvider({ slug, number, children }: LessonCtx & { children: ReactNode }) {
  return <LessonContext.Provider value={{ slug, number }}>{children}</LessonContext.Provider>;
}
export const useLesson = () => useContext(LessonContext);

export function collapseAllSections(open: boolean) {
  window.dispatchEvent(new CustomEvent("osk8s:sections", { detail: { open } }));
}

type BYS = { will?: ReactNode; time?: ReactNode; learn?: ReactNode; prereq?: ReactNode; start?: ReactNode; children?: ReactNode };
export function BeforeYouStart({ will, time, learn, prereq, start, children }: BYS) {
  const [open, setOpen] = useState(true);
  const row = (k: string, v?: ReactNode) => v ? <p><strong className="text-[var(--color-fg)]">{k}:</strong> {v}</p> : null;
  return (
    <div className="not-prose my-6 rounded-lg border border-[var(--color-line)] border-l-4 border-l-[var(--color-info)] bg-[var(--color-panel)]">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 px-5 py-3 text-left font-semibold text-[var(--color-info)]">
        <ChevronDown size={16} className={`transition ${open ? "" : "-rotate-90"}`} /> Before you start
      </button>
      {open && (
        <div className="space-y-2 px-5 pb-4 text-[0.95rem] leading-relaxed text-[var(--color-fg-dim)]">
          {row("Learn", learn)}{row("Prerequisites", prereq)}{row("Start here", start)}
          {row("You will", will)}{row("Time", time)}
          {children}
        </div>
      )}
    </div>
  );
}

/** Collapsed-by-default aside for depth that is not on the main path. */
export function Optional({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="not-prose my-6 rounded-lg border border-[var(--color-line)] border-l-4 border-l-[var(--color-info)] bg-[var(--color-panel)]">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 px-5 py-3 text-left font-semibold text-[var(--color-info)]">
        <ChevronRight size={16} className={`transition ${open ? "rotate-90" : ""}`} /> Optional: {title}
      </button>
      {open && <div className="prose max-w-none px-5 pb-4">{children}</div>}
    </div>
  );
}

/** "What you learned": a list of **Lead.** detail bullets, then "Next, <link>". */
export function Learned({ next, nextLabel, children }: { next?: string; nextLabel?: string; children: ReactNode }) {
  return (
    <div className="learned">
      {children}
      {next && <p>Next, <Link href={next} className="text-[var(--color-nv-bright)] underline">{nextLabel ?? "continue"}</Link>.</p>}
    </div>
  );
}


export function Section({ n, title, goal, children }: { n: string | number; title: ReactNode; goal?: ReactNode; children: ReactNode }) {
  const { slug, number } = useLesson();
  const id = `${number}.${n}`;
  const [open, setOpen] = useState(true);
  const progress = useProgress();
  // Steps register themselves (children of a server-rendered MDX page arrive
  // as lazy client references, so their types can't be inspected here).
  const [stepIds, setStepIds] = useState<string[]>([]);
  const register = useCallback((k: string) => {
    setStepIds((a) => (a.includes(k) ? a : [...a, k]));
    return () => setStepIds((a) => a.filter((x) => x !== k));
  }, []);
  const done = stepIds.filter((k) => progress.steps[k]).length;
  useEffect(() => {
    const on = (e: Event) => setOpen((e as CustomEvent<{ open: boolean }>).detail.open);
    window.addEventListener("osk8s:sections", on);
    return () => window.removeEventListener("osk8s:sections", on);
  }, []);
  return (
    <section className="my-10" id={`s-${id}`}>
      <button onClick={() => setOpen(!open)} className="not-prose flex w-full items-center gap-3 text-left">
        <ChevronDown size={20} className={`shrink-0 text-[var(--color-nv-bright)] transition ${open ? "" : "-rotate-90"}`} />
        <span role="heading" aria-level={2} className="text-[22px] font-bold leading-[37.4px] text-[var(--color-fg)]">{id} · {title}</span>
      </button>
      {goal && (
        <p className="not-prose mt-2 text-[14px] text-[var(--color-fg-dim)]">
          <span className="mr-2 font-semibold text-[var(--color-fg-mut)]">Goal</span>{goal}
          {stepIds.length > 0 && <span className="text-[var(--color-fg-mut)]"> · {done} of {stepIds.length} steps done</span>}
        </p>
      )}
      {open && <SectionContext.Provider value={{ id, register }}><div className="steps mt-5">{children}</div></SectionContext.Provider>}
    </section>
  );
}

export function Step({ n, title, children }: { n: string | number; title: ReactNode; children: ReactNode }) {
  const { slug } = useLesson();
  const { id: sectionId, register } = useContext(SectionContext);
  const id = `${sectionId}.${n}`;
  const key = `${slug}:${id}`;
  const progress = useProgress();
  const done = !!progress.steps[key];
  const [open, setOpen] = useState(true);
  const [live, setLive] = useState<LiveRun>(null);
  useEffect(() => {
    const clear = () => setLive(null);
    window.addEventListener("osk8s:clear-outputs", clear);
    return () => window.removeEventListener("osk8s:clear-outputs", clear);
  }, []);
  useEffect(() => register(key), [register, key]);
  const [outputs, setOutputs] = useState(0);
  const markOutput = useCallback(() => { setOutputs((n) => n + 1); return () => setOutputs((n) => n - 1); }, []);
  return (
    <StepContext.Provider value={{ id: key, hasOutput: outputs > 0, live, setLive, markOutput }}>
      <div className="step-card overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)]">
        <div className="not-prose flex items-center gap-2.5 bg-[var(--color-ink2)] px-3.5 py-2.5">
          <span className="rounded-xl bg-[var(--color-nv)] px-[7px] text-[13px] font-bold leading-[22px] text-[#08110a]">{id}</span>
          <button onClick={() => setOpen(!open)} className="flex-1 text-left text-[15px] font-bold text-[var(--color-fg)]">{title}</button>
          <button onClick={() => setOpen(!open)} className="text-[var(--color-fg-mut)]" title={open ? "Collapse" : "Expand"}>
            <ChevronDown size={14} className={`transition ${open ? "" : "-rotate-90"}`} />
          </button>
          <button
            onClick={() => setStepDone(key, !done)}
            title={done ? "Mark as not done" : "Mark as done"}
            className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs font-bold ${done ? "border-[var(--color-nv)] bg-[var(--color-nv)] text-[#0a0d07]" : "border-[var(--color-line-2)] text-transparent hover:border-[var(--color-nv)]"}`}
          >✓</button>
        </div>
        {open && <div className="prose step-body max-w-none px-4 pb-3 pt-0.5">{children}</div>}
      </div>
    </StepContext.Provider>
  );
}
