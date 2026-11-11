"use client";
// A figure from docs/*.svg, drawn in the page in the site's colours:
//   <Fig id="architecture" n="0.2" caption="The whole lab on one VM." />
// Click a box to read what it is; Enlarge opens it full screen.
import { useEffect, useMemo, useRef, useState } from "react";
import { Maximize2, X } from "lucide-react";
import { FIGURE_SVG } from "@/lib/figures.generated";
import { FIGURE_NOTES } from "@/lib/figure-notes";
import { FIGURE_TOURS } from "@/lib/figure-tours";

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

/** The same figure as a guided tour: pick a path, and only its boxes and
 *  arrows stay lit (the arrows march in the direction of flow), with numbered
 *  markers on the picture matching the numbered description. Steps play one
 *  after another; click a marker or a line to jump to it.
 *    <FigTour id="architecture" n="0.1" caption="…" />  tours: lib/figure-tours.ts */
export function FigTour({ id, n, caption }: { id: string; n?: string; caption?: string }) {
  const f = FIGURE_SVG[id];
  const tour = FIGURE_TOURS[id] ?? [];
  const [path, setPath] = useState(0);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);
  const cur = tour[path];

  // light this path's boxes and arrows, dim the rest: the classes are baked
  // into the markup, so React swaps it when the path changes
  const svg = useMemo(() => {
    if (!f || !cur) return "";
    const on = new Set(cur.nodes);
    return f.svg
      .replace('<svg class="dg-svg"', '<svg class="dg-svg dg-touring"')
      .replace(/<g class="dg-node" data-node="([^"]*)">/g, (m, name) => (on.has(name) ? `<g class="dg-node dg-hl" data-node="${name}">` : m))
      .replace(/<g data-flow="([^"]*)">/g, (m, fl: string) => (fl.split(" ").includes(cur.flow) ? `<g class="dg-hl" data-flow="${fl}">` : m));
  }, [f, cur]);

  // play the steps one after another
  useEffect(() => {
    if (!playing || !cur) return;
    const t = window.setTimeout(() => {
      if (step < cur.steps.length - 1) setStep(step + 1);
      else setPlaying(false);
    }, 3200);
    return () => window.clearTimeout(t);
  }, [playing, step, cur]);

  if (!f || !cur) return null;
  const choose = (i: number) => { setPath(i); setStep(0); setPlaying(true); };
  const jump = (i: number) => { setStep(i); setPlaying(false); };
  return (
    <figure className="not-prose my-7">
      <div className="mb-3 flex flex-wrap gap-2">
        {tour.map((t, i) => (
          <button key={i} onClick={() => choose(i)}
            className={`rounded-full border px-3 py-1 text-[13px] font-semibold transition ${i === path ? "border-[var(--color-nv)] bg-[var(--color-run-btn)] text-[var(--color-nv-bright)]" : "border-[var(--color-line-2)] text-[var(--color-fg-dim)] hover:text-[var(--color-fg)]"}`}>
            <span className="mr-1.5 font-mono">{i + 1}</span>{t.title}
          </button>
        ))}
      </div>
      <div className="rounded-[10px] border border-[var(--color-line)] bg-[var(--color-ink2)] p-3">
        <div className="overflow-x-auto">
          <div className="relative min-w-[760px]">
            <div dangerouslySetInnerHTML={{ __html: svg }} />
            <svg viewBox={`0 0 ${f.w} ${f.h}`} className="pointer-events-none absolute inset-0 h-full w-full">
              {cur.steps.map((s, i) => (
                <g key={`${path}-${i}`} className="pointer-events-auto cursor-pointer" onClick={() => jump(i)}
                  style={{ animation: `swapIn .4s ease ${i * 0.08}s both` }}>
                  {i === step && <circle cx={s.x} cy={s.y} r={26} fill="none" stroke="var(--color-nv-bright)" strokeWidth={3} className="dg-ping" />}
                  <circle cx={s.x} cy={s.y} r={i === step ? 19 : 16} fill={i === step ? "var(--color-nv-bright)" : "var(--color-nv)"} stroke="var(--color-bg)" strokeWidth={3} />
                  <text x={s.x} y={s.y + 6} textAnchor="middle" fontSize={i === step ? 18 : 16} fontWeight={800} fill="#0b0f05">{i + 1}</text>
                </g>
              ))}
            </svg>
          </div>
        </div>
      </div>
      <div className="mt-3 rounded-[10px] border border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="text-[15px] font-bold text-[var(--color-fg)]">{path + 1} · {cur.title}</div>
          <button onClick={() => (playing ? setPlaying(false) : (step >= cur.steps.length - 1 ? choose(path) : setPlaying(true)))}
            className="ml-auto rounded-md border border-[var(--color-line-2)] px-2.5 py-0.5 text-[12px] text-[var(--color-fg-dim)] hover:text-[var(--color-fg)]">
            {playing ? "❚❚ Pause" : step >= cur.steps.length - 1 ? "↻ Replay" : "▶ Play"}
          </button>
          {path < tour.length - 1 && (
            <button onClick={() => choose(path + 1)} className="rounded-md border border-[var(--color-run-btn-line)] bg-[var(--color-run-btn)] px-2.5 py-0.5 text-[12px] font-bold text-[var(--color-nv-bright)]">
              Next path →
            </button>
          )}
        </div>
        <p className="mt-1 text-[14px] text-[var(--color-fg-dim)]">{cur.intro}</p>
        <ol className="mt-2 space-y-1">
          {cur.steps.map((s, i) => (
            <li key={i} onClick={() => jump(i)}
              className={`flex cursor-pointer gap-3 rounded-md px-2 py-1.5 text-[14px] leading-[22px] transition ${i === step ? "bg-[rgba(118,185,0,0.12)]" : "hover:bg-[var(--color-ink2)]"}`}>
              <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold text-[#0b0f05] ${i === step ? "bg-[var(--color-nv-bright)]" : i < step ? "bg-[var(--color-nv)]" : "bg-[var(--color-line-2)]"}`}>{i + 1}</span>
              <span className={i === step ? "text-[var(--color-fg)]" : "text-[var(--color-fg-dim)]"}><b className="text-[var(--color-fg)]">{s.title}.</b> {s.text}</span>
            </li>
          ))}
        </ol>
      </div>
      <figcaption className="mt-2 text-[13px] leading-[1.55] text-[var(--color-fg-dim)]">
        {n && <>Figure {n}. </>}{caption ?? f.title}
      </figcaption>
    </figure>
  );
}
