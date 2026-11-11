"use client";
// A static figure drawn in the page, in the course template's style:
//   <Fig id="architecture" n="0.2" caption="The whole lab on one VM." />
// Boxes with something to say are clickable; the note appears under the figure.
import { useState } from "react";
import { FIGURES } from "@/lib/figures";
import type { DNode } from "@/lib/diagrams";
import { NodeView, EdgeView } from "./LiveDiagram";

export function Fig({ id, n, caption }: { id: string; n?: string; caption?: string }) {
  const f = FIGURES[id];
  const [sel, setSel] = useState<DNode | null>(null);
  if (!f) return null;
  const nodes = Object.fromEntries(f.nodes.map((x) => [x.id, x]));
  const pick = (x: DNode) => setSel((s) => (s?.id === x.id ? null : x));
  return (
    <figure className="not-prose mx-auto my-6" style={{ maxWidth: Math.min(f.w, 980) }}>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${f.w} ${f.h}`} role="img" aria-label={f.title} className="dg-fig mx-auto block h-auto w-full" style={{ minWidth: 640 }}>
          {f.nodes.filter((x) => x.kind === "group").map((x) => <NodeView key={x.id} n={x} st="old" selected={sel?.id === x.id} onSelect={pick} />)}
          {f.edges.map((e, i) => <EdgeView key={i} e={e} nodes={nodes} st="old" uid={id} />)}
          {f.nodes.filter((x) => x.kind !== "group").map((x) => <NodeView key={x.id} n={x} st="old" selected={sel?.id === x.id} onSelect={pick} />)}
        </svg>
      </div>
      {sel?.info ? (
        <div className="mt-3 rounded-lg border border-[var(--color-nv-dim)] bg-[var(--color-panel)] px-4 py-3 text-sm leading-relaxed text-[var(--color-fg-dim)]">
          <span className="font-semibold text-[var(--color-fg)]">{sel.label}. </span>{sel.info}
        </div>
      ) : null}
      <figcaption className="mt-2 text-[13px] leading-[1.55] text-[var(--color-fg-dim)]">
        {n && <>Figure {n}. </>}{caption ?? f.title}{" "}
        <span className="text-[var(--color-fg-mut)]">Click a box to read about it.</span>
      </figcaption>
    </figure>
  );
}
