"use client";
// "Continue through the module": a card per lesson of this module (after the
// overview), in the order you take them.
//   <ModuleLessons module="m1" />
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CURRICULUM, ALL_LESSONS } from "@/lib/curriculum";
import { useProgress } from "@/lib/progress";

export function ModuleLessons({ module }: { module: string }) {
  const progress = useProgress();
  if (!CURRICULUM.find((p) => p.id === module)) return null;
  const lessons = ALL_LESSONS.filter((l) => l.partId === module && !l.slug.endsWith("-overview"));
  return (
    <div className="not-prose my-5 grid items-stretch gap-x-2 gap-y-3 sm:grid-cols-[1fr_auto_1fr]">
      {lessons.map((l, i) => {
        const done = !!progress.lessons[l.slug];
        return [
          <Link key={l.slug} href={`/learn/${l.slug}`}
            className="group flex flex-col rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)] px-3.5 py-3 transition hover:border-[var(--color-nv-dim)]">
            <div className="flex items-center text-[12px] font-bold text-[var(--color-nv-bright)]">
              {l.number}{done && <span className="ml-auto text-[11px] font-semibold">✓ done</span>}
            </div>
            <div className="mt-0.5 text-[14px] font-bold text-[var(--color-fg)] group-hover:text-[var(--color-nv-bright)]">{l.title}</div>
            <p className="mt-0.5 flex-1 text-[13px] leading-[19.5px] text-[var(--color-fg-dim)]">{l.blurb}</p>
            <div className="mt-2 font-mono text-[11px] text-[var(--color-fg-mut)]">{l.kind === "lab" ? "lab: runs on your VM" : l.kind === "check" ? "questions on the page" : "reading"} · {l.minutes} min</div>
          </Link>,
          i % 2 === 0 && i < lessons.length - 1
            ? <span key={l.slug + "-a"} className="hidden items-center text-[var(--color-fg-mut)] sm:flex"><ArrowRight size={14} /></span>
            : null,
        ];
      })}
    </div>
  );
}
