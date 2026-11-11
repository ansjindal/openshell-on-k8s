"use client";
// "Continue through the module": a card per lesson of this module (after the
// overview), with its number, time, kind and your progress.
//   <ModuleLessons module="m1" />
import Link from "next/link";
import { CURRICULUM, ALL_LESSONS } from "@/lib/curriculum";
import { useProgress } from "@/lib/progress";

export function ModuleLessons({ module }: { module: string }) {
  const progress = useProgress();
  const part = CURRICULUM.find((p) => p.id === module);
  if (!part) return null;
  const lessons = ALL_LESSONS.filter((l) => l.partId === module && !l.slug.endsWith("-overview"));
  return (
    <div className="not-prose my-6 grid gap-3 sm:grid-cols-2">
      {lessons.map((l) => {
        const done = !!progress.lessons[l.slug];
        return (
          <Link key={l.slug} href={`/learn/${l.slug}`}
            className="group rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-3 transition hover:border-[var(--color-nv-dim)]">
            <div className="flex items-center gap-2 text-xs text-[var(--color-fg-mut)]">
              <span className="rounded bg-[var(--color-panel-2)] px-1.5 py-0.5 font-mono font-semibold text-[var(--color-fg-dim)]">{l.number}</span>
              <span>{l.kind === "lab" ? "Lab" : l.kind === "check" ? "Check" : "Read"} · {l.minutes} min</span>
              {done && <span className="ml-auto text-[var(--color-nv-bright)]">✓ done</span>}
            </div>
            <div className="mt-1.5 font-semibold text-[var(--color-fg)] group-hover:text-[var(--color-nv-bright)]">{l.title}</div>
            <p className="mt-1 text-sm leading-relaxed text-[var(--color-fg-dim)]">{l.blurb}</p>
          </Link>
        );
      })}
    </div>
  );
}
