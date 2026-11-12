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
import { setStepDone, useProgress } from "@/lib/progress";

type LessonCtx = { slug: string; number: string };
const LessonContext = createContext<LessonCtx>({ slug: "", number: "" });
const SectionContext = createContext<{ id: string; register: (stepKey: string) => () => void }>({ id: "", register: () => () => {} });

export type LiveRun = { text: string; exit: number | null } | null;
export const StepContext = createContext<{ id: string; hasOutput: boolean; live: LiveRun; setLive: (r: LiveRun) => void; markOutput: () => () => void; cmds: string[]; addCmd: (c: string) => () => void }>({
  id: "", hasOutput: false, live: null, setLive: () => {}, markOutput: () => () => {}, cmds: [], addCmd: () => () => {},
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
  const row = (k: string, v?: ReactNode) => v ? <p><strong>{k}:</strong> {v}</p> : null;
  return (
    <details className="callout note" open>
      <summary>Before you start</summary>
      {row("Learn", learn)}{row("Prerequisites", prereq)}{row("Start here", start)}
      {row("You will", will)}{row("Time", time)}
      {children}
    </details>
  );
}

/** Collapsed-by-default aside for depth that is not on the main path. */
export function Optional({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="callout tip">
      <summary>Optional: {title}</summary>
      {children}
    </details>
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
  const { number } = useLesson();
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
    <>
      <h2 id={`s-${id}`} className={`foldable${open ? "" : " folded"}`} title="Collapse or expand this section" onClick={() => setOpen(!open)}>{id} · {title}</h2>
      {goal && (
        <div className="rl-secmap">
          <span className="rl-smlabel">Goal</span><span className="rl-smgoal">{goal}</span>
          {stepIds.length > 0 && <span className="rl-smprog"> · {done} of {stepIds.length} steps done</span>}
        </div>
      )}
      <SectionContext.Provider value={{ id, register }}>
        <div className="sec-steps" style={open ? undefined : { display: "none" }}>{children}</div>
      </SectionContext.Provider>
    </>
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
  // the commands of this step, in order (shown with what they printed)
  const [cmds, setCmds] = useState<string[]>([]);
  const addCmd = useCallback((c: string) => { setCmds((a) => (a.includes(c) ? a : [...a, c])); return () => setCmds((a) => a.filter((x) => x !== c)); }, []);
  return (
    <StepContext.Provider value={{ id: key, hasOutput: outputs > 0, live, setLive, markOutput, cmds, addCmd }}>
      <section className={`step${done ? " done" : ""}${open ? "" : " collapsed"}`}>
        <div className="stephead">
          <button type="button" className="steptoggle" aria-expanded={open} onClick={() => setOpen(!open)}>
            <span className="stepnum">{id}</span><span className="steptitle">{title}</span>
          </button>
          <button className="stepdone" title={done ? "mark this step not done" : "mark this step complete"} aria-label="mark step complete" onClick={() => setStepDone(key, !done)} />
        </div>
        {open && <div className="stepbody">{children}</div>}
      </section>
    </StepContext.Provider>
  );
}
