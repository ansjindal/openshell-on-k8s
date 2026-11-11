"use client";
// "The picture builds as you read": numbered cards on the left, a sticky
// diagram on the right that gains each card's layer as it scrolls into view.
//   <ScrollBuild diagram="stack" items={[{ title: "…", text: "…" }, …]} />
// Card i (1-based) shows layers 0..i of the diagram, with layer i highlighted.
import { useEffect, useRef, useState } from "react";
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
  return (
    <div className="not-prose my-6 grid gap-4 lg:grid-cols-[1fr_1.05fr]">
      <div className="space-y-2.5">
        {items.map((it, i) => (
          <div key={i} data-i={i + 1} ref={(el) => { refs.current[i] = el; }}
            onClick={() => setActive(i + 1)}
            className={`cursor-pointer rounded-lg border px-3.5 py-3 transition ${i + 1 === active ? "border-[var(--color-nv)] bg-[var(--color-panel)]" : i + 1 < active ? "border-[var(--color-line)] bg-[var(--color-panel)]" : "border-[var(--color-line)] bg-[var(--color-panel)] opacity-60"}`}>
            <div className="flex items-center gap-2 text-[14px] font-bold text-[var(--color-fg)]">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-nv)] text-[11px] font-bold text-[#0a0d07]">{i + 1}</span>
              {it.title}
            </div>
            <p className="mt-1.5 text-[13px] leading-[19.5px] text-[var(--color-fg-dim)]">{it.text}</p>
          </div>
        ))}
      </div>
      <div>
        <div className="sticky top-24">
          <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-ink2)] p-2.5">
            
            <DiagramSvg id={diagram} layer={active} />
          </div>
          <p className="mt-2 text-center text-[13px] text-[var(--color-fg-dim)]">{caption ?? "Scroll through the steps: the picture builds as you read."}</p>
        </div>
      </div>
    </div>
  );
}
