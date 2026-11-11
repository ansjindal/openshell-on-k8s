"use client";
import { setLessonDone, useProgress } from "@/lib/progress";

export function MarkComplete({ slug }: { slug: string }) {
  const p = useProgress();
  const done = !!p.lessons[slug];
  return (
    <div className="mt-10 flex justify-end">
      <button
        onClick={() => setLessonDone(slug, !done)}
        className={`rounded-lg border px-5 py-2.5 text-sm font-semibold transition ${done ? "border-[var(--color-nv)] bg-[var(--color-nv)] text-[#0a0d07]" : "border-[var(--color-nv-dim)] text-[var(--color-nv-bright)] hover:bg-[var(--color-run-bg)]"}`}
      >
        {done ? "✓ Completed" : "Mark as complete"}
      </button>
    </div>
  );
}
