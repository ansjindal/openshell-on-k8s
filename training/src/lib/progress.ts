"use client";
// Course progress, kept in this browser only (localStorage): which steps and
// lessons are done, and quiz answers. Components subscribe through useProgress().
import { useEffect, useState } from "react";

type Store = { steps: Record<string, boolean>; lessons: Record<string, boolean>; quiz: Record<string, number> };
const KEY = "osk8s:progress:v1";
const EVT = "osk8s:progress";

function read(): Store {
  if (typeof window === "undefined") return { steps: {}, lessons: {}, quiz: {} };
  try {
    const s = JSON.parse(window.localStorage.getItem(KEY) || "{}");
    return { steps: s.steps || {}, lessons: s.lessons || {}, quiz: s.quiz || {} };
  } catch {
    return { steps: {}, lessons: {}, quiz: {} };
  }
}
function write(s: Store) {
  try { window.localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode */ }
  window.dispatchEvent(new Event(EVT));
}

export function setStepDone(id: string, done: boolean) { const s = read(); s.steps[id] = done; write(s); }
export function setLessonDone(slug: string, done: boolean) { const s = read(); s.lessons[slug] = done; write(s); }
export function setQuizAnswer(id: string, choice: number) { const s = read(); s.quiz[id] = choice; write(s); }
export function resetProgress() { write({ steps: {}, lessons: {}, quiz: {} }); }
// "Clear outputs": run outputs live in component state; this event wipes them.
export function clearOutputs() { window.dispatchEvent(new Event("osk8s:clear-outputs")); }

export function useProgress(): Store {
  const [s, setS] = useState<Store>({ steps: {}, lessons: {}, quiz: {} });
  useEffect(() => {
    const on = () => setS(read());
    on();
    window.addEventListener(EVT, on);
    window.addEventListener("storage", on);
    return () => { window.removeEventListener(EVT, on); window.removeEventListener("storage", on); };
  }, []);
  return s;
}
