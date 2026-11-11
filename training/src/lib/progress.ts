"use client";
// Course progress, kept in this browser only (localStorage): which steps and
// lessons are done, and quiz answers. Components subscribe through useProgress().
import { useEffect, useState } from "react";

type Store = { steps: Record<string, boolean>; lessons: Record<string, boolean>; quiz: Record<string, number>; outputs: Record<string, string> };
const KEY = "osk8s:progress:v1";
const EVT = "osk8s:progress";

function read(): Store {
  if (typeof window === "undefined") return { steps: {}, lessons: {}, quiz: {}, outputs: {} };
  try {
    const s = JSON.parse(window.localStorage.getItem(KEY) || "{}");
    return { steps: s.steps || {}, lessons: s.lessons || {}, quiz: s.quiz || {}, outputs: s.outputs || {} };
  } catch {
    return { steps: {}, lessons: {}, quiz: {}, outputs: {} };
  }
}
function write(s: Store) {
  try { window.localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode */ }
  window.dispatchEvent(new Event(EVT));
}

export function setStepDone(id: string, done: boolean) { const s = read(); s.steps[id] = done; write(s); }
export function setLessonDone(slug: string, done: boolean) { const s = read(); s.lessons[slug] = done; write(s); }
export function setQuizAnswer(id: string, choice: number) { const s = read(); s.quiz[id] = choice; write(s); }
// The output of a successful run, kept per step (and per command within the
// step) so live diagrams can draw what your commands actually found.
export function setStepOutput(stepId: string, cmdKey: string, text: string) {
  const s = read(); s.outputs[`${stepId}#${cmdKey}`] = text.slice(0, 8000); write(s);
}
export function stepOutput(store: Store, stepId: string): string | undefined {
  const parts = Object.entries(store.outputs).filter(([k]) => k.startsWith(`${stepId}#`)).map(([, v]) => v);
  return parts.length ? parts.join("\n") : undefined;
}
export function resetProgress() { write({ steps: {}, lessons: {}, quiz: {}, outputs: {} }); }
// "Clear outputs": wipes the run panels (component state) and the saved outputs.
export function clearOutputs() {
  const s = read(); s.outputs = {}; write(s);
  window.dispatchEvent(new Event("osk8s:clear-outputs"));
}

export function useProgress(): Store {
  const [s, setS] = useState<Store>({ steps: {}, lessons: {}, quiz: {}, outputs: {} });
  useEffect(() => {
    const on = () => setS(read());
    on();
    window.addEventListener(EVT, on);
    window.addEventListener("storage", on);
    return () => { window.removeEventListener(EVT, on); window.removeEventListener("storage", on); };
  }, []);
  return s;
}
