"use client";
// Knowledge check: one question at a time, answers kept in this browser.
//   <Quiz title="Test your knowledge: Module 2">
//     <Q q="…" options={["a", "b", "c", "d"]} answer={1} why="…" />
//   </Quiz>
// A progress bar and a dot per question on top (click to jump), compact A–D
// options in two columns, the explanation right under them once answered,
// Previous / Next, and a score summary after the last question.
import { Children, isValidElement, useEffect, useState, type ReactNode } from "react";
import { Check, X, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { clearQuiz, setLessonDone, setQuizAnswer, useProgress } from "@/lib/progress";
import { useLesson } from "./Structure";

type QProps = { q: ReactNode; options: ReactNode[]; answer: number; why?: ReactNode };
const LETTERS = "ABCDEFGH";

export function Quiz({ title, children }: { title: string; children: ReactNode }) {
  const { slug } = useLesson();
  const progress = useProgress();
  const items = (Children.toArray(children).filter((c) => isValidElement(c)) as React.ReactElement<QProps>[]).map((c) => c.props);
  const n = items.length;
  const chosen = (i: number) => progress.quiz[`${slug}:${i}`];
  const answered = items.filter((_, i) => chosen(i) !== undefined).length;
  const correct = items.filter((q, i) => chosen(i) === q.answer).length;
  // start at the first unanswered question (or the summary when all are done)
  const [cur, setCur] = useState(0);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (ready) return;
    const first = items.findIndex((_, i) => chosen(i) === undefined);
    setCur(first < 0 ? n : first);
    setReady(true);
  }, [progress, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  const dot = (i: number) => {
    const c = chosen(i);
    const base = "h-2.5 w-2.5 rounded-full transition";
    const col = c === undefined ? "bg-[var(--color-line-2)]" : c === items[i].answer ? "bg-[var(--color-nv)]" : "bg-red-500/80";
    return `${base} ${col} ${i === cur ? "ring-2 ring-[var(--color-nv-bright)] ring-offset-2 ring-offset-[var(--color-panel)]" : ""}`;
  };

  return (
    <div className="not-prose my-8 overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)]">
      <div className="border-b border-[var(--color-line)] px-5 pb-3 pt-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] font-bold text-[var(--color-fg)]">{title}</span>
          <span className="font-mono text-[12px] text-[var(--color-fg-mut)]">{answered} of {n} answered · {correct} correct</span>
        </div>
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[var(--color-line)]">
          <div className="h-full rounded-full bg-[var(--color-nv)] transition-all duration-500" style={{ width: `${n ? (answered / n) * 100 : 0}%` }} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {items.map((_, i) => (
            <button key={i} aria-label={`Question ${i + 1}`} title={`Question ${i + 1}`} onClick={() => setCur(i)} className={dot(i)} />
          ))}
          <button onClick={() => setCur(n)} className={`ml-1 text-[12px] ${cur === n ? "font-bold text-[var(--color-nv-bright)]" : "text-[var(--color-fg-mut)] hover:text-[var(--color-fg)]"}`}>Score</button>
        </div>
      </div>

      {cur < n ? (
        <QView key={cur} {...items[cur]} idx={cur} total={n} chosen={chosen(cur)}
          onPick={(o) => setQuizAnswer(`${slug}:${cur}`, o)}
          onPrev={cur > 0 ? () => setCur(cur - 1) : undefined}
          onNext={() => setCur(cur + 1)} last={cur === n - 1} />
      ) : (
        <div className="px-5 py-7 text-center">
          <div className="text-[34px] font-bold text-[var(--color-fg)]">{correct} / {n}</div>
          <p className="mt-1 text-[15px] text-[var(--color-fg-dim)]">
            {answered < n ? `${n - answered} question${n - answered === 1 ? "" : "s"} still open: click a grey dot to answer it.`
              : correct === n ? "All correct." : "Red dots are the ones to revisit: click one to see why."}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            {correct === n && n > 0 && (
              <button onClick={() => setLessonDone(slug, true)}
                className="rounded-lg border border-[var(--color-nv)] bg-[var(--color-nv)] px-4 py-2 text-[14px] font-bold text-[#0b0f05] hover:brightness-110">
                Mark this check as complete
              </button>
            )}
            <button onClick={() => { clearQuiz(slug); setCur(0); }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-line-2)] px-4 py-2 text-[14px] text-[var(--color-fg-dim)] hover:text-[var(--color-fg)]">
              <RotateCcw size={14} /> Start again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function Q(_props: QProps) { return null; }

function QView({ q, options, answer, why, idx, total, chosen, onPick, onPrev, onNext, last }:
  QProps & { idx: number; total: number; chosen?: number; onPick: (i: number) => void; onPrev?: () => void; onNext: () => void; last: boolean }) {
  const answered = chosen !== undefined;
  const right = chosen === answer;
  return (
    <div className="px-5 py-5" style={{ animation: "swapIn .25s ease both" }}>
      <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-fg-mut)]">Question {idx + 1} of {total}</div>
      <div className="mt-1.5 text-[17px] font-semibold leading-[1.5] text-[var(--color-fg)]">{q}</div>
      <div className="mt-4 grid gap-2.5 md:grid-cols-2">
        {options.map((o, i) => {
          const isChosen = chosen === i;
          const state = !answered ? "idle" : i === answer ? "right" : isChosen ? "wrong" : "dim";
          const box = {
            idle: "border-[var(--color-line)] hover:border-[var(--color-nv-dim)] hover:bg-[var(--color-ink2)]",
            right: "border-[var(--color-nv)] bg-[rgba(118,185,0,0.10)]",
            wrong: "border-red-500/70 bg-red-500/10",
            dim: "border-[var(--color-line)] opacity-60",
          }[state];
          const badge = {
            idle: "border border-[var(--color-line-2)] text-[var(--color-fg-dim)]",
            right: "bg-[var(--color-nv)] text-[#0b0f05]",
            wrong: "bg-red-500 text-white",
            dim: "border border-[var(--color-line-2)] text-[var(--color-fg-mut)]",
          }[state];
          return (
            <button key={i} onClick={() => onPick(i)}
              className={`flex items-start gap-3 rounded-lg border px-3.5 py-2.5 text-left text-[14.5px] leading-[1.45] text-[var(--color-fg)] transition ${box}`}>
              <span className={`mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[12px] font-bold ${badge}`}>
                {state === "right" ? <Check size={14} strokeWidth={3} /> : state === "wrong" ? <X size={14} strokeWidth={3} /> : LETTERS[i]}
              </span>
              <span>{o}</span>
            </button>
          );
        })}
      </div>
      {answered && (
        <div className={`mt-4 rounded-lg border-l-4 px-4 py-3 text-[14px] leading-[1.6] ${right ? "border-[var(--color-nv)] bg-[rgba(118,185,0,0.08)]" : "border-red-500 bg-red-500/10"}`}>
          <b className={right ? "text-[var(--color-nv-bright)]" : "text-red-500"}>{right ? "Correct." : `Not quite: the answer is ${LETTERS[answer]}.`}</b>{" "}
          {why && <span className="text-[var(--color-fg-dim)]">{why}</span>}
        </div>
      )}
      <div className="mt-5 flex items-center justify-between">
        <button onClick={onPrev} disabled={!onPrev}
          className="inline-flex items-center gap-1 text-[13px] text-[var(--color-fg-dim)] hover:text-[var(--color-fg)] disabled:invisible">
          <ChevronLeft size={15} /> Previous
        </button>
        <button onClick={onNext}
          className={`inline-flex items-center gap-1 rounded-lg px-4 py-2 text-[13.5px] font-bold transition ${answered ? "border border-[var(--color-nv)] bg-[var(--color-nv)] text-[#0b0f05] hover:brightness-110" : "border border-[var(--color-line-2)] text-[var(--color-fg-dim)] hover:text-[var(--color-fg)]"}`}>
          {last ? "See your score" : answered ? "Next question" : "Skip"} <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}
