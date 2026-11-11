"use client";
// "The picture builds as you read": numbered cards on the left, a sticky
// diagram on the right that gains each card's layer as it scrolls into view.
//   <ScrollBuild diagram="stack" items={[{ title: "…", text: "…" }, …]} />
// Card i (1-based) shows layers 0..i of the diagram, with layer i highlighted.
import { useEffect, useRef, useState } from "react";
import { DIAGRAMS } from "@/lib/diagrams";
import { DiagramSvg } from "./LiveDiagram";

export function ScrollBuild({ diagram, items, caption }: { diagram: string; items: { title: string; text: string }[]; caption?: string }) {
  const [active, setActive] = useState(1);
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      const visible = entries.filter((e) => e.isIntersecting).map((e) => Number((e.target as HTMLElement).dataset.i));
      if (visible.length) setActive((a) => Math.max(...visible) >= a ? Math.max(...visible) : Math.min(...visible));
    }, { rootMargin: "-35% 0px -45% 0px" });
    refs.current.forEach((r) => r && io.observe(r));
    return () => io.disconnect();
  }, []);
  const d = DIAGRAMS[diagram];
  return (
    <div className="not-prose my-6 grid gap-5 lg:grid-cols-[2fr_3fr]">
      <div className="space-y-3">
        {items.map((it, i) => (
          <div key={i} data-i={i + 1} ref={(el) => { refs.current[i] = el; }}
            onClick={() => setActive(i + 1)}
            className={`cursor-pointer rounded-lg border px-4 py-3 transition ${i + 1 === active ? "border-[var(--color-nv-dim)] bg-[var(--color-run-bg)]" : i + 1 < active ? "border-[var(--color-line)] bg-[var(--color-panel)]" : "border-[var(--color-line)] bg-[var(--color-panel)] opacity-60"}`}>
            <div className="flex items-center gap-2 font-semibold text-[var(--color-fg)]">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-nv)] text-[11px] font-bold text-[#0a0d07]">{i + 1}</span>
              {it.title}
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-fg-dim)]">{it.text}</p>
          </div>
        ))}
      </div>
      <div>
        <div className="sticky top-24">
          <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-out-bg)] p-3">
            {d && <div className="mb-2 text-center text-xs font-semibold text-[var(--color-fg-dim)]">{d.title}</div>}
            <DiagramSvg id={diagram} layer={active} />
          </div>
          <p className="mt-2 text-center text-xs text-[var(--color-fg-mut)]">{caption ?? "Scroll through the steps: the picture builds as you read."}</p>
        </div>
      </div>
    </div>
  );
}
