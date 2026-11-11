"use client";
// Knowledge check: multiple-choice questions, answers kept in this browser.
//   <Quiz title="Test your knowledge: Module 1">
//     <Q q="…" options={["a", "b", "c", "d"]} answer={1} why="…" />
//   </Quiz>
import { Children, isValidElement, type ReactNode } from "react";
import { setLessonDone, setQuizAnswer, useProgress } from "@/lib/progress";
import { useLesson } from "./Structure";

type QProps = { q: ReactNode; options: ReactNode[]; answer: number; why?: ReactNode; idx?: number };

export function Quiz({ title, children }: { title: string; children: ReactNode }) {
  const { slug } = useLesson();
  const progress = useProgress();
  const items = Children.toArray(children).filter((c) => isValidElement(c)) as React.ReactElement<QProps>[];
  const correct = items.filter((c, i) => progress.quiz[`${slug}:${i}`] === c.props.answer).length;
  return (
    <div className="not-prose my-8 overflow-hidden rounded-xl border border-[var(--color-nv-dim)] bg-[var(--color-panel)]">
      <div className="flex items-center justify-between border-b border-[var(--color-nv-dim)] bg-[var(--color-run-bg)] px-5 py-3">
        <span className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--color-nv-bright)]">{title}</span>
        <span className="font-mono text-xs text-[var(--color-fg-mut)]">{correct} / {items.length}</span>
      </div>
      <div className="divide-y divide-[var(--color-line)]">
        {items.map((c, i) => <QView key={i} {...c.props} idx={i} slug={slug} chosen={progress.quiz[`${slug}:${i}`]} />)}
      </div>
      {correct === items.length && items.length > 0 && (
        <div className="border-t border-[var(--color-line)] px-5 py-3 text-sm text-[var(--color-nv-bright)]">
          All correct. <button className="underline" onClick={() => setLessonDone(slug, true)}>Mark this module&apos;s check as complete</button>
        </div>
      )}
    </div>
  );
}

export function Q(_props: QProps) { return null; }

function QView({ q, options, answer, why, idx = 0, slug, chosen }: QProps & { slug: string; chosen?: number }) {
  const answered = chosen !== undefined;
  return (
    <div className="px-5 py-5">
      <div className="mb-3 flex gap-3 font-semibold text-[var(--color-fg)]">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-nv)] text-xs font-bold text-[#0a0d07]">{idx + 1}</span>
        <span>{q}</span>
      </div>
      <div className="space-y-2">
        {options.map((o, i) => {
          const isChosen = chosen === i;
          const state = !answered ? "idle" : i === answer ? (isChosen ? "right" : "reveal") : isChosen ? "wrong" : "idle";
          const cls = {
            idle: "border-[var(--color-line)] hover:border-[var(--color-nv-dim)]",
            right: "border-[var(--color-nv)] bg-[var(--color-run-bg)]",
            reveal: "border-[var(--color-nv-dim)] border-dashed",
            wrong: "border-red-600/70 bg-red-950/30",
          }[state];
          return (
            <button key={i} onClick={() => setQuizAnswer(`${slug}:${idx}`, i)}
              className={`block w-full rounded-lg border px-4 py-2.5 text-left text-[0.92rem] text-[var(--color-fg-dim)] transition ${cls}`}>
              {o}
            </button>
          );
        })}
      </div>
      {answered && (
        <p className={`mt-3 text-sm ${chosen === answer ? "text-[var(--color-nv-bright)]" : "text-[var(--color-rh-bright)]"}`}>
          {chosen === answer ? "Correct." : "Not quite."} {why && <span className="text-[var(--color-fg-dim)]">{why}</span>}
        </p>
      )}
    </div>
  );
}
