"use client";
// A figure from docs/*.svg, drawn in the page in the site's colours:
//   <Fig id="architecture" n="0.2" caption="The whole lab on one VM." />
// Click a box to read what it is; Enlarge opens it full screen.
import { useEffect, useRef, useState } from "react";
import { Maximize2, X } from "lucide-react";
import { FIGURE_SVG } from "@/lib/figures.generated";
import { FIGURE_NOTES } from "@/lib/figure-notes";

export function Fig({ id, n, caption }: { id: string; n?: string; caption?: string }) {
  const f = FIGURE_SVG[id];
  const ref = useRef<HTMLDivElement>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [big, setBig] = useState(false);
  useEffect(() => {
    ref.current?.querySelectorAll(".dg-node").forEach((g) => g.classList.toggle("dg-sel", g.getAttribute("data-node") === sel));
  }, [sel]);
  useEffect(() => {
    if (!big) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setBig(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [big]);
  if (!f) return null;
  const onClick = (e: React.MouseEvent) => {
    const g = (e.target as Element).closest("[data-node]");
    const k = g?.getAttribute("data-node") ?? null;
    setSel((s) => (k && s !== k && FIGURE_NOTES[id]?.[k] ? k : null));
  };
  const note = sel ? FIGURE_NOTES[id]?.[sel] : undefined;
  return (
    <figure className="not-prose my-7">
      <div className="relative rounded-[10px] border border-[var(--color-line)] bg-[var(--color-ink2)] p-3">
        <button onClick={() => setBig(true)} title="Enlarge"
          className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-md border border-[var(--color-line-2)] bg-[var(--color-panel)] px-2 py-1 text-[11px] text-[var(--color-fg-mut)] hover:text-[var(--color-fg)]">
          <Maximize2 size={11} /> Enlarge
        </button>
        <div ref={ref} onClick={onClick} className="overflow-x-auto [&_svg]:min-w-[760px]" dangerouslySetInnerHTML={{ __html: f.svg }} />
      </div>
      {note && (
        <div className="mt-2 rounded-lg border border-[var(--color-nv-dim)] bg-[var(--color-panel)] px-4 py-2.5 text-[14px] leading-[23px] text-[var(--color-fg-dim)]">
          <span className="font-semibold text-[var(--color-fg)]">{sel}. </span>{note}
        </div>
      )}
      <figcaption className="mt-2 text-[13px] leading-[1.55] text-[var(--color-fg-dim)]">
        {n && <>Figure {n}. </>}{caption ?? f.title} <span className="text-[var(--color-fg-mut)]">Click a box to read about it.</span>
      </figcaption>
      {big && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4" onClick={() => setBig(false)}>
          <div className="relative max-h-full w-full max-w-[1700px] overflow-auto rounded-xl border border-[var(--color-line-2)] bg-[var(--color-ink2)] p-4" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setBig(false)} className="absolute right-3 top-3 text-[var(--color-fg-mut)] hover:text-[var(--color-fg)]" title="Close (Esc)"><X size={18} /></button>
            <div className="[&_svg]:min-w-[1200px]" dangerouslySetInnerHTML={{ __html: f.svg.replaceAll(`id="${id}-`, `id="big-${id}-`).replaceAll(`#${id}-`, `#big-${id}-`) }} />
          </div>
        </div>
      )}
    </figure>
  );
}
