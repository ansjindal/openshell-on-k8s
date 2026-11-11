"use client";
// A diagram that gains a layer with each lab step.
//   <LiveDiagram id="create-sandbox" layer={2} />
// Layers below `layer` are drawn; this step's layer is a dashed placeholder until
// the step is done (a successful Run ticks it), then it fills in, highlighted as
// "new in this step". Later layers stay hidden. Specs live in lib/diagrams.ts.
import { useContext } from "react";
import { DIAGRAMS, type DNode, type DEdge } from "@/lib/diagrams";
import { StepContext } from "./Structure";
import { useProgress } from "@/lib/progress";

type State = "hidden" | "ghost" | "new" | "old";

function stateOf(layer: number, until: number | undefined, cur: number, done: boolean): State {
  if (until !== undefined && (cur > until || (cur === until && done))) return "hidden";
  if (layer < cur) return "old";
  if (layer === cur) return done ? "new" : "ghost";
  return "hidden";
}

function anchor(a: DNode, b: DNode): [number, number, number, number] {
  const acx = a.x + a.w / 2, acy = a.y + a.h / 2, bcx = b.x + b.w / 2, bcy = b.y + b.h / 2;
  if (b.x >= a.x + a.w) return [a.x + a.w, acy, b.x, bcy];
  if (b.x + b.w <= a.x) return [a.x, acy, b.x + b.w, bcy];
  if (b.y >= a.y + a.h) return [acx, a.y + a.h, bcx, b.y];
  return [acx, a.y, bcx, b.y + b.h];
}

const C = {
  stroke: "var(--color-line-2)", text: "var(--color-fg)", sub: "var(--color-fg-mut)",
  nv: "var(--color-nv)", nvb: "var(--color-nv-bright)", red: "#e5484d", blue: "var(--color-info)",
  box: "var(--color-panel-2)", group: "transparent",
};

function NodeView({ n, st }: { n: DNode; st: State }) {
  if (st === "hidden") return null;
  const ghost = st === "ghost";
  const isNew = st === "new";
  const group = n.kind === "group";
  const tone = n.kind === "deny" ? C.red : n.kind === "ext" ? C.blue : n.kind === "accent" ? C.nv : C.stroke;
  const stroke = ghost ? C.sub : isNew ? C.nvb : tone;
  return (
    <g opacity={ghost ? 0.55 : 1} style={{ transition: "opacity .4s" }}>
      <rect x={n.x} y={n.y} width={n.w} height={n.h} rx={group ? 12 : 9}
        fill={group ? C.group : C.box} stroke={stroke} strokeWidth={isNew ? 2.2 : group ? 1.2 : 1.4}
        strokeDasharray={ghost ? "6 5" : group ? "4 4" : undefined}
        style={isNew ? { filter: "drop-shadow(0 0 6px rgba(118,185,0,.55))" } : undefined} />
      {group ? (
        <text x={n.x + 12} y={n.y + 18} fontSize={11.5} fill={C.sub} fontFamily="var(--font-mono)">{n.label}</text>
      ) : (
        <>
          <text x={n.x + 12} y={n.y + (n.sub ? 24 : n.h / 2 + 5)} fontSize={13.5} fontWeight={700} fill={ghost ? C.sub : C.text}>{n.label}</text>
          {n.sub && n.sub.split("\n").map((line, i) => (
            <text key={i} x={n.x + 12} y={n.y + 42 + i * 15} fontSize={11.5} fill={C.sub} fontFamily="var(--font-mono)">{line}</text>
          ))}
          {ghost && <text x={n.x + n.w - 10} y={n.y + 18} fontSize={10} fill={C.sub} textAnchor="end">▷ this step adds it</text>}
        </>
      )}
    </g>
  );
}

function EdgeView({ e, nodes, st }: { e: DEdge; nodes: Record<string, DNode>; st: State }) {
  if (st === "hidden") return null;
  const a = nodes[e.from], b = nodes[e.to];
  if (!a || !b) return null;
  const [x1, y1, x2, y2] = anchor(a, b);
  const ghost = st === "ghost";
  const col = ghost ? C.sub : e.kind === "deny" ? C.red : e.kind === "ok" || st === "new" ? C.nvb : C.sub;
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const id = `ah-${e.kind ?? "n"}-${st}`;
  return (
    <g opacity={ghost ? 0.5 : 1}>
      <defs>
        <marker id={id} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill={col} />
        </marker>
      </defs>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={col} strokeWidth={st === "new" ? 2.2 : 1.5}
        strokeDasharray={ghost || e.kind === "dash" ? "5 4" : undefined} markerEnd={`url(#${id})`} />
      {e.kind === "deny" && <text x={mx} y={my + 5} fontSize={16} fontWeight={700} fill={C.red} textAnchor="middle">✕</text>}
      {e.label && (
        <text x={mx + (e.dx ?? 0)} y={my - 7 + (e.dy ?? 0)} fontSize={11} fill={col} textAnchor="middle" fontFamily="var(--font-mono)"
          stroke="var(--color-bg)" strokeWidth={4} paintOrder="stroke">{e.label}</text>
      )}
    </g>
  );
}

export function LiveDiagram({ id, layer }: { id: string; layer: number }) {
  const d = DIAGRAMS[id];
  const step = useContext(StepContext);
  const progress = useProgress();
  if (!d) return null;
  const done = !!(step.id && progress.steps[step.id]);
  const nodes = Object.fromEntries(d.nodes.map((n) => [n.id, n]));
  const cur = d.layers.find((l) => l.n === layer);
  // A not-yet-done node that replaces a visible one (same position) waits
  // behind it instead of drawing a placeholder on top.
  const st = (n: DNode): State => {
    const s = stateOf(n.layer, n.until, layer, done);
    if (s === "ghost" && d.nodes.some((o) => o !== n && o.x === n.x && o.y === n.y && stateOf(o.layer, o.until, layer, done) === "old")) return "hidden";
    return s;
  };
  return (
    <div className="not-prose my-5 overflow-hidden rounded-lg border border-[var(--color-out-line)] bg-[var(--color-out-bg)]">
      <div className="flex items-center gap-3 border-b border-[var(--color-out-line)] px-4 py-2">
        <span className="rounded bg-[var(--color-info)] px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-white">DIAGRAM</span>
        <span className="text-sm text-[var(--color-fg-dim)]">{d.title}</span>
        <span className="ml-auto text-xs text-[var(--color-fg-mut)]">{done ? "updated by this step" : "complete this step to add its layer"}</span>
      </div>
      <div className="overflow-x-auto px-3 py-3">
        <svg viewBox={`0 0 ${d.w} ${d.h}`} className="mx-auto block w-full" style={{ maxWidth: d.w, minWidth: 640 }} role="img" aria-label={d.title}>
          {d.nodes.filter((n) => n.kind === "group").map((n) => <NodeView key={n.id} n={n} st={st(n)} />)}
          {d.edges.map((e, i) => <EdgeView key={i} e={e} nodes={nodes} st={stateOf(e.layer, e.until, layer, done)} />)}
          {d.nodes.filter((n) => n.kind !== "group").map((n) => <NodeView key={n.id} n={n} st={st(n)} />)}
        </svg>
      </div>
      <div className="flex flex-wrap gap-2 border-t border-[var(--color-out-line)] px-4 py-2.5">
        {d.layers.filter((l) => l.n > 0).map((l) => (
          <span key={l.n} className={`rounded-full border px-2.5 py-0.5 text-[11px] ${
            l.n === layer ? (done ? "border-[var(--color-nv)] text-[var(--color-nv-bright)]" : "border-dashed border-[var(--color-fg-mut)] text-[var(--color-fg-mut)]")
            : l.n < layer ? "border-[var(--color-line-2)] text-[var(--color-fg-dim)]" : "border-[var(--color-line)] text-[var(--color-fg-mut)] opacity-50"}`}>
            {l.n === layer ? "+ " : ""}{l.name}{l.n === layer ? ": new in this step" : ""}
          </span>
        ))}
      </div>
      {cur?.note && <p className="border-t border-[var(--color-out-line)] px-4 py-2.5 text-sm text-[var(--color-fg-dim)]">{cur.note}</p>}
    </div>
  );
}
