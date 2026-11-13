"use client";
// A diagram that gains a layer with each lab step.
//   <LiveDiagram id="create-sandbox" layer={2} />
// Layers below `layer` are drawn; this step's layer is a dashed placeholder until
// the step is done (a successful Run ticks it), then it fills in, highlighted as
// "new in this step". Later layers stay hidden. Specs live in lib/diagrams.ts.
import { useContext, useEffect } from "react";
import { DIAGRAMS, type DNode, type DEdge } from "@/lib/diagrams";
import { ICONS } from "@/lib/icons.generated";
import { StepContext, useLesson } from "./Structure";
import { stepOutput, useProgress } from "@/lib/progress";
import { OutputContext } from "./Output";

export type State = "hidden" | "ghost" | "new" | "old";

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

// Drawn in the course template's figure style: panels on the page background,
// centered titles, one accent colour for what matters.
const C = {
  line: "var(--color-line-2)", text: "var(--color-fg)", sub: "var(--color-fg-dim)", mut: "var(--color-fg-mut)",
  nv: "var(--color-nv-bright)", red: "#e5484d", blue: "var(--color-info)",
  box: "var(--color-panel-2)", group: "var(--color-panel)",
};
const SANS = "var(--font-sans)";

export function NodeView({ n, st }: { n: DNode; st: State | "future" }) {
  if (st === "hidden") return null;
  const future = st === "future";
  const ghost = st === "ghost";
  const isNew = st === "new";
  const group = n.kind === "group";
  const tone = n.kind === "deny" ? C.red : n.kind === "ext" ? C.blue : n.kind === "accent" ? C.nv : C.line;
  const stroke = ghost ? C.mut : isNew ? C.nv : tone;
  const subs = n.sub ? n.sub.split("\n") : [];
  const block = 14 + subs.length * 16;
  const y0 = n.y + (n.h - block) / 2 + 12;
  const ic = n.icon && ICONS[n.icon];
  const tx = n.x + 12 + (ic ? 24 : 0);
  const icon = (x: number, y: number) => ic ? (
    <svg x={x} y={y} width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round" style={{ color: stroke === C.line ? C.sub : stroke }} dangerouslySetInnerHTML={{ __html: ic }} />
  ) : null;
  return (
    <g opacity={future ? 0.2 : ghost ? 0.55 : 1} style={{ transition: "opacity .45s" }}>
      <rect x={n.x} y={n.y} width={n.w} height={n.h} rx={group ? 9 : 7}
        fill={group ? C.group : C.box} fillOpacity={group ? 0.5 : 1} stroke={stroke} strokeWidth={isNew ? 2.2 : n.kind === "accent" ? 1.8 : 1.3}
        strokeDasharray={ghost || n.dashed ? "6 5" : undefined}
        style={isNew ? { filter: "drop-shadow(0 0 6px rgba(146,230,0,.45))" } : undefined} />
      {group ? (
        <>{icon(n.x + 10, n.y + 6)}<text x={tx} y={n.y + 19} fontSize={12.5} fontWeight={700} fill={C.sub} fontFamily={SANS}>{n.label}</text></>
      ) : (
        <>
          {icon(n.x + 10, y0 - 14)}
          <text x={tx} y={y0} fontSize={13.5} fontWeight={700} fill={C.text} fontFamily={SANS}>{n.label}</text>
          {subs.map((line, i) => (
            <text key={i} x={tx} y={y0 + 16 * (i + 1)} fontSize={12} fill={C.sub} fontFamily={SANS}>{line}</text>
          ))}
        </>
      )}
    </g>
  );
}

export function EdgeView({ e, nodes, st, uid = "" }: { e: DEdge; nodes: Record<string, DNode>; st: State | "future"; uid?: string }) {
  if (st === "hidden") return null;
  const future = st === "future";
  const a = nodes[e.from], b = nodes[e.to];
  if (!a || !b) return null;
  const [x1, y1, x2, y2] = anchor(a, b);
  const ghost = st === "ghost";
  const col = ghost ? C.mut : e.kind === "deny" ? C.red : e.kind === "ok" || st === "new" ? C.nv : C.mut;
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const id = `ah${uid}-${e.kind ?? "n"}-${st}`;
  return (
    <g opacity={future ? 0.18 : ghost ? 0.5 : 1} style={{ transition: "opacity .45s" }}>
      <defs>
        <marker id={id} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 Z" fill={col} />
        </marker>
      </defs>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={col} strokeWidth={e.kind === "ok" || st === "new" ? 2 : 1.7}
        strokeDasharray={ghost || e.kind === "dash" ? "5 4" : undefined} markerEnd={`url(#${id})`} />
      {e.kind === "deny" && <text x={mx} y={my + 5} fontSize={15} fontWeight={700} fill={C.red} textAnchor="middle">✕</text>}
      {e.label && (
        <text x={mx + (e.dx ?? 0)} y={my - 6 + (e.dy ?? 0)} fontSize={10.5} fontWeight={700} fill={e.kind === "ok" ? C.nv : C.text} textAnchor="middle" fontFamily={SANS}
          stroke="var(--color-bg)" strokeWidth={4} paintOrder="stroke">{e.label}</text>
      )}
    </g>
  );
}

export function LiveDiagram({ id, layer }: { id: string; layer: number }) {
  const d = DIAGRAMS[id];
  const step = useContext(StepContext);
  const octx = useContext(OutputContext);
  const inOutput = octx.inside;
  useEffect(() => octx.markDiagram(), [octx.markDiagram]); // eslint-disable-line react-hooks/exhaustive-deps
  const { slug, number } = useLesson();
  const progress = useProgress();
  if (!d) return null;
  // In an OUTPUT the step's layer is shown drawn: before your run it is the
  // recorded picture, after it the same picture with your values.
  const done = !!(step.id && progress.steps[step.id]) || inOutput;
  // Output of the step behind each layer (if you ran it): diagrams draw what
  // your commands actually found, not only the textbook picture.
  // The recorded fold draws the recorded picture; only "Your output" uses your values.
  const recorded = octx.mode === "recorded";
  const out = (n: number) => {
    if (recorded) return undefined;
    const l = d.layers.find((x) => x.n === n);
    return l?.step ? stepOutput(progress, `${slug}:${number}.${l.step}`) : undefined;
  };
  const resolved: DNode[] = d.nodes.map((n) => {
    if (!n.dyn) return n;
    try { const v = n.dyn(out); return v ? { ...n, ...v, live: true } : n; } catch { return n; }
  });
  const edges: DEdge[] = d.edges.map((e) => {
    if (!e.dyn) return e;
    try { const v = e.dyn(out); return v ? { ...e, label: v } : e; } catch { return e; }
  });
  const anyLive = resolved.some((n) => n.live) || edges.some((e, i) => e.label !== d.edges[i].label);
  const nodes = Object.fromEntries(resolved.map((n) => [n.id, n]));
  const cur = d.layers.find((l) => l.n === layer);
  // A not-yet-done node that replaces a visible one (same position) waits
  // behind it instead of drawing a placeholder on top.
  const st = (n: DNode): State => {
    const s = stateOf(n.layer, n.until, layer, done);
    if (s === "ghost" && resolved.some((o) => o.id !== n.id && o.x === n.x && o.y === n.y && stateOf(o.layer, o.until, layer, done) === "old")) return "hidden";
    return s;
  };
  const svg = (
    <svg viewBox={`0 0 ${d.w} ${d.h}`} className="mx-auto block w-full" style={{ maxWidth: d.w }} role="img" aria-label={d.title}>
      {resolved.filter((n) => n.kind === "group").map((n) => <NodeView key={n.id} n={n} st={st(n)} />)}
      {edges.map((e, i) => <EdgeView key={i} e={e} nodes={nodes} st={stateOf(e.layer, e.until, layer, done)} />)}
      {resolved.filter((n) => n.kind !== "group").map((n) => <NodeView key={n.id} n={n} st={st(n)} />)}
    </svg>
  );
  const legend = (
    <div className="rl-klegend">
      {d.layers.filter((l) => l.n > 0).map((l) => (
        <span key={l.n} className={`rl-klg ${l.n === layer ? "new" : l.n < layer ? "done" : "later"}`}>
          {l.n === layer ? "+ " : l.n < layer ? "✓ " : ""}{l.name}{l.n === layer ? ": new in this step" : ""}
        </span>
      ))}
    </div>
  );
  if (inOutput) {
    return (
      <div className="rl-ktourbody">
        {anyLive && <div className="rl-kcap"><span className="rl-kdot ok" /><span>Values from your runs</span></div>}
        {svg}
        {legend}
        {cur?.note && <ul className="rl-khow"><li>{cur.note}</li></ul>}
      </div>
    );
  }
  return (
    <div className="rl-box rl-ktourout">
      <div className="rl-boxhead"><span className="rl-badge do">Diagram</span><span className="rl-boxhint">{d.title}</span></div>
      <div className="rl-boxbody"><div className="rl-ktourbody">{svg}{legend}{cur?.note && <ul className="rl-khow"><li>{cur.note}</li></ul>}</div></div>
    </div>
  );
}
LiveDiagram.displayName = "LiveDiagram";

/** The same drawing without a step: layers up to `layer`, the last highlighted.
 *  Used by ScrollBuild (module overviews), where scrolling picks the layer. */
export function DiagramSvg({ id, layer }: { id: string; layer: number }) {
  const d = DIAGRAMS[id];
  if (!d) return null;
  const nodes = Object.fromEntries(d.nodes.map((n) => [n.id, n]));
  // Scroll-built: what earlier cards added is drawn, this card's layer glows,
  // later layers wait faintly so the whole picture is visible from the start.
  const st = (l: number): State | "future" => (l < layer ? "old" : l === layer ? "new" : "future");
  return (
    <svg viewBox={`0 0 ${d.w} ${d.h}`} className="block h-auto w-full" role="img" aria-label={d.title}>
      {d.nodes.filter((n) => n.kind === "group").map((n) => <NodeView key={n.id} n={n} st={st(n.layer)} />)}
      {d.edges.map((e, i) => <EdgeView key={i} e={e} nodes={nodes} st={st(e.layer)} uid={id} />)}
      {d.nodes.filter((n) => n.kind !== "group").map((n) => <NodeView key={n.id} n={n} st={st(n.layer)} />)}
    </svg>
  );
}

/** A diagram from lib/diagrams.ts drawn whole, as a figure:
 *    <Diagram id="gateway-place" n="0.2" caption="…" /> */
export function Diagram({ id, n, caption }: { id: string; n?: string; caption?: string }) {
  const d = DIAGRAMS[id];
  if (!d) return null;
  return (
    <figure className="not-prose my-6">
      <div className="rounded-[10px] border border-[var(--color-line)] bg-[var(--color-ink2)] p-4">
        <div className="mx-auto max-w-[900px]"><DiagramSvg id={id} layer={Infinity} /></div>
      </div>
      <figcaption className="mt-2 text-[13px] leading-[1.55] text-[var(--color-fg-dim)]">{n && <>Figure {n}. </>}{caption ?? d.title}</figcaption>
    </figure>
  );
}
