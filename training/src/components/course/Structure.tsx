"use client";
// Lesson structure, modelled on step-by-step lab courses:
//   <BeforeYouStart will="…" time="…" />
//   <Section n="1" title="…" goal="…">
//     <Step n="1" title="…"> prose, <Run>, <ExpectedOutput>, prose </Step>
//   </Section>
// Numbers combine with the lesson's own number: lesson 1.4, section 1, step 2 -> 1.4.1.2.
import { Children, createContext, isValidElement, useContext, useEffect, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { setStepDone, useProgress } from "@/lib/progress";

type LessonCtx = { slug: string; number: string };
const LessonContext = createContext<LessonCtx>({ slug: "", number: "" });
const SectionContext = createContext<{ id: string; collapseAll: number }>({ id: "", collapseAll: 0 });
export const StepContext = createContext<{ id: string }>({ id: "" });

export function LessonProvider({ slug, number, children }: LessonCtx & { children: ReactNode }) {
  return <LessonContext.Provider value={{ slug, number }}>{children}</LessonContext.Provider>;
}
export const useLesson = () => useContext(LessonContext);

// "collapse all sections" broadcast
export function collapseAllSections(open: boolean) {
  window.dispatchEvent(new CustomEvent("osk8s:sections", { detail: { open } }));
}

export function BeforeYouStart({ will, time, children }: { will?: ReactNode; time?: ReactNode; children?: ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="not-prose my-6 rounded-lg border border-[var(--color-line)] border-l-4 border-l-[var(--color-info)] bg-[var(--color-panel)]">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 px-5 py-3 text-left font-semibold text-[var(--color-info)]">
        <ChevronDown size={16} className={`transition ${open ? "" : "-rotate-90"}`} /> Before you start
      </button>
      {open && (
        <div className="space-y-2 px-5 pb-4 text-[0.95rem] leading-relaxed text-[var(--color-fg-dim)]">
          {will && <p><strong className="text-[var(--color-fg)]">You will:</strong> {will}</p>}
          {time && <p><strong className="text-[var(--color-fg)]">Time:</strong> {time}</p>}
          {children}
        </div>
      )}
    </div>
  );
}

function countSteps(children: ReactNode, sectionId: string): string[] {
  const ids: string[] = [];
  Children.forEach(children, (c) => {
    if (isValidElement(c) && c.type === Step) ids.push(`${sectionId}.${(c.props as { n: string | number }).n}`);
  });
  return ids;
}

export function Section({ n, title, goal, children }: { n: string | number; title: ReactNode; goal?: ReactNode; children: ReactNode }) {
  const { slug, number } = useLesson();
  const id = `${number}.${n}`;
  const [open, setOpen] = useState(true);
  const progress = useProgress();
  const stepIds = countSteps(children, id);
  const done = stepIds.filter((s) => progress.steps[`${slug}:${s}`]).length;
  useEffect(() => {
    const on = (e: Event) => setOpen((e as CustomEvent<{ open: boolean }>).detail.open);
    window.addEventListener("osk8s:sections", on);
    return () => window.removeEventListener("osk8s:sections", on);
  }, []);
  return (
    <section className="my-10" id={`s-${id}`}>
      <button onClick={() => setOpen(!open)} className="not-prose flex w-full items-center gap-3 text-left">
        <ChevronDown size={20} className={`shrink-0 text-[var(--color-nv-bright)] transition ${open ? "" : "-rotate-90"}`} />
        <span role="heading" aria-level={2} className="text-2xl font-bold tracking-tight text-[var(--color-fg)]">{id} · {title}</span>
      </button>
      {goal && (
        <p className="not-prose mt-3 text-sm text-[var(--color-fg-dim)]">
          <span className="mr-2 font-semibold text-[var(--color-fg-mut)]">Goal</span>{goal}
          {stepIds.length > 0 && <span className="text-[var(--color-fg-mut)]"> · {done} of {stepIds.length} steps done</span>}
        </p>
      )}
      {open && <SectionContext.Provider value={{ id, collapseAll: 0 }}><div className="mt-5 space-y-5">{children}</div></SectionContext.Provider>}
    </section>
  );
}

export function Step({ n, title, children }: { n: string | number; title: ReactNode; children: ReactNode }) {
  const { slug } = useLesson();
  const { id: sectionId } = useContext(SectionContext);
  const id = `${sectionId}.${n}`;
  const key = `${slug}:${id}`;
  const progress = useProgress();
  const done = !!progress.steps[key];
  const [open, setOpen] = useState(true);
  return (
    <StepContext.Provider value={{ id: key }}>
      <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)]">
        <div className="not-prose flex items-center gap-3 border-b border-[var(--color-line)] px-4 py-3">
          <span className="rounded-md bg-[var(--color-nv)] px-2 py-0.5 font-mono text-xs font-bold text-[#0a0d07]">{id}</span>
          <button onClick={() => setOpen(!open)} className="flex-1 text-left font-semibold text-[var(--color-fg)]">{title}</button>
          <button onClick={() => setOpen(!open)} className="text-[var(--color-fg-mut)]" title={open ? "Collapse" : "Expand"}>
            <ChevronDown size={14} className={`transition ${open ? "" : "-rotate-90"}`} />
          </button>
          <button
            onClick={() => setStepDone(key, !done)}
            title={done ? "Mark as not done" : "Mark as done"}
            className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs font-bold ${done ? "border-[var(--color-nv)] bg-[var(--color-nv)] text-[#0a0d07]" : "border-[var(--color-line-2)] text-transparent hover:border-[var(--color-nv)]"}`}
          >✓</button>
        </div>
        {open && <div className="prose max-w-none px-4 py-2">{children}</div>}
      </div>
    </StepContext.Provider>
  );
}
