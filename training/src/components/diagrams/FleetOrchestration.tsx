"use client";
// Module 4: how the SRE copilot fleet investigates one incident, step by step.
// Five steps play in turn (ask → orchestrate → investigate → conclude → approve):
// the active step's boxes light up and data flows along its arrows; earlier
// steps stay drawn, later ones are dimmed. Click a step to jump to it; the
// player pauses while the pointer is over the figure, and doesn't autoplay
// for people who prefer reduced motion. Colors come from the site's theme
// variables, so it follows light and dark mode.
import { useEffect, useRef, useState } from "react";

const STEPS = [
  { name: "Ask", text: "You press Investigate in the incident panel: one incident, one question for the fleet." },
  { name: "Orchestrate", text: "The orchestrator, built into the page, follows a fixed plan: it hands each specialist the one probe for its signal. It calls no model itself; the agents do the thinking." },
  { name: "Investigate", text: "The four specialists run in parallel, each pi in its own sandbox. Each may call only the sre-tools tools its policy names: anything else, and scale_deployment for every agent, is refused by its supervisor." },
  { name: "Conclude", text: "Their findings go to the analyst, a pi agent with no tools at all. It combines them into a root cause and a recommended fix." },
  { name: "You approve", text: "Nothing changes until you approve the fix. Every tool call, and every refusal, is in the audit trail." },
];

const SPECIALISTS = [
  { name: "logs", tools: "loki_query" },
  { name: "metrics", tools: "prometheus_query" },
  { name: "traces", tools: "tempo_search" },
  { name: "events", tools: "cluster_events · pod_status" },
];

const W = 980, H = 410;
const LANES = [
  { x: 10, w: 160 }, { x: 186, w: 180 }, { x: 382, w: 300 }, { x: 698, w: 272 },
];
const SP = { x: 400, w: 264, h: 62, y0: 62, gap: 82 };
const OR = { x: 200, y: 168, w: 152, h: 84 };
const YOU = { x: 22, y: 178, w: 136, h: 64 };
const AN = { x: 714, y: 92, w: 240, h: 130 };
const AP = { x: 714, y: 286, w: 240, h: 76 };

export function FleetOrchestration() {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [hover, setHover] = useState(false);
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (reduced.current) { setPlaying(false); setStep(STEPS.length - 1); }
  }, []);

  useEffect(() => {
    if (!playing || hover) return;
    const last = step === STEPS.length - 1;
    const t = setTimeout(() => setStep((s) => (s + 1) % STEPS.length), last ? 5200 : 3600);
    return () => clearTimeout(t);
  }, [step, playing, hover]);

  // 0 = not yet (dim), 1 = the active step, 2 = done (drawn, calm)
  const st = (i: number) => (i < step ? 2 : i === step ? 1 : 0);
  const op = (i: number) => (st(i) === 0 ? 0.38 : 1);

  const Box = ({ x, y, w, h, i, tone, title, lines }: { x: number; y: number; w: number; h: number; i: number; tone: string; title: string; lines: string[] }) => {
    const active = st(i) === 1;
    const top = y + h / 2 - (lines.length * 15) / 2 - 1;
    return (
      <g style={{ opacity: op(i), transition: "opacity .45s" }}>
        <rect x={x} y={y} width={w} height={h} rx={10} fill="var(--color-panel)" stroke={tone}
          strokeWidth={active ? 2.4 : 1.4} className={active ? "fo-pulse" : undefined} />
        <text x={x + w / 2} y={top} fontSize={13.5} fontWeight={700} fill="var(--color-fg)" textAnchor="middle">{title}</text>
        {lines.map((l, k) => (
          <text key={k} x={x + w / 2} y={top + 17 + k * 15} fontSize={11} fill="var(--color-fg-mut)" textAnchor="middle">{l}</text>
        ))}
      </g>
    );
  };

  const Arrow = ({ d, i, tone }: { d: string; i: number; tone: string }) => {
    const s = st(i);
    return (
      <g style={{ opacity: op(i), transition: "opacity .45s" }}>
        <path d={d} fill="none" stroke={s === 1 ? tone : "var(--color-fg-mut)"} strokeWidth={s === 1 ? 2.2 : 1.5}
          strokeDasharray={s === 1 ? "6 6" : undefined} className={s === 1 ? "fo-flow" : undefined}
          markerEnd={`url(#fo-arrow-${s === 1 ? "on" : "off"})`} />
      </g>
    );
  };

  const NV = "var(--color-nv)";
  const AMBER = "#d9962b";
  const cy = (k: number) => SP.y0 + k * SP.gap + SP.h / 2;

  return (
    <figure className="my-6 overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)]"
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-line)] px-4 py-2.5">
        {STEPS.map((s, i) => (
          <button key={s.name} type="button" onClick={() => { setStep(i); setPlaying(false); }}
            className={`rounded-full border px-3 py-1 text-[12.5px] font-semibold transition-colors ${
              i === step ? "border-[var(--color-nv)] bg-[var(--color-nv)] text-[#0b0f05]"
              : i < step ? "border-[var(--color-nv-dim)] text-[var(--color-nv-bright)]"
              : "border-[var(--color-line-2)] text-[var(--color-fg-mut)]"}`}>
            {i + 1} · {s.name}
          </button>
        ))}
        <button type="button" onClick={() => { if (!playing && step === STEPS.length - 1) setStep(0); setPlaying(!playing); }}
          className="ml-auto rounded-md border border-[var(--color-line-2)] px-2.5 py-1 text-[12px] text-[var(--color-fg-mut)] hover:text-[var(--color-fg)]">
          {playing ? "Pause" : "Play"}
        </button>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img"
        aria-label="The SRE copilot fleet: you ask, the orchestrator hands each of four sealed specialists one probe, an analyst with no tools combines their findings, and you approve the fix."
        style={{ fontFamily: "Inter, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif" }}>
        <style>{`
          .fo-flow{animation:fo-dash .9s linear infinite}
          @keyframes fo-dash{to{stroke-dashoffset:-12}}
          .fo-pulse{animation:fo-pulse 1.8s ease-in-out infinite}
          @keyframes fo-pulse{50%{stroke-opacity:.45}}
          @media (prefers-reduced-motion: reduce){.fo-flow,.fo-pulse{animation:none}}
        `}</style>
        <defs>
          <marker id="fo-arrow-on" markerWidth="10" markerHeight="10" refX="7" refY="3.5" orient="auto"><path d="M0,0 L8,3.5 L0,7 Z" fill="var(--color-nv)" /></marker>
          <marker id="fo-arrow-off" markerWidth="10" markerHeight="10" refX="7" refY="3.5" orient="auto"><path d="M0,0 L8,3.5 L0,7 Z" fill="var(--color-fg-mut)" /></marker>
        </defs>

        {LANES.map((l, i) => {
          const on = i === 3 ? step >= 3 : i === step;
          return (
            <g key={i}>
              <rect x={l.x} y={36} width={l.w} height={H - 46} rx={12} fill="var(--color-fg)"
                style={{ opacity: on ? 0.06 : 0.025, transition: "opacity .45s" }} />
              <text x={l.x + l.w / 2} y={24} fontSize={11.5} fontWeight={800} letterSpacing=".08em" textAnchor="middle"
                fill={on ? "var(--color-nv-bright)" : "var(--color-fg-mut)"}>
                {["1 · ASK", "2 · ORCHESTRATE", "3 · INVESTIGATE, IN PARALLEL", "4 · CONCLUDE   5 · APPROVE"][i]}
              </text>
            </g>
          );
        })}

        {/* arrows first, so boxes sit on top */}
        <Arrow i={0} tone={NV} d={`M${YOU.x + YOU.w},${YOU.y + YOU.h / 2} L${OR.x - 4},${YOU.y + YOU.h / 2}`} />
        {SPECIALISTS.map((_, k) => (
          <Arrow key={`o${k}`} i={1} tone={NV} d={`M${OR.x + OR.w},${OR.y + OR.h / 2} L${SP.x - 4},${cy(k)}`} />
        ))}
        {SPECIALISTS.map((_, k) => (
          <Arrow key={`f${k}`} i={3} tone={NV} d={`M${SP.x + SP.w},${cy(k)} L${AN.x - 4},${AN.y + 30 + k * 23}`} />
        ))}
        <Arrow i={4} tone={NV} d={`M${AN.x + AN.w / 2},${AN.y + AN.h} L${AN.x + AN.w / 2},${AP.y - 4}`} />

        <Box {...YOU} i={0} tone="var(--color-fg-mut)" title="You" lines={["press Investigate", "one incident"]} />
        <Box {...OR} i={1} tone="#8b7bd8" title="Orchestrator" lines={["in this page", "fixed plan", "one probe each"]} />
        {SPECIALISTS.map((s, k) => (
          <Box key={s.name} x={SP.x} y={SP.y0 + k * SP.gap} w={SP.w} h={SP.h} i={2} tone={NV}
            title={`${s.name} · pi, sealed`} lines={[`may call ${s.tools} only`]} />
        ))}
        <Box {...AN} i={3} tone={AMBER} title="analyst · pi" lines={["no tools at all", "combines the findings", "→ a root cause", "→ a recommended fix"]} />
        <Box {...AP} i={4} tone="var(--color-fg-mut)" title="You approve the fix" lines={["nothing changes until you do"]} />
      </svg>

      <figcaption className="min-h-[3.2rem] border-t border-[var(--color-line)] px-4 py-3 text-[14px] leading-relaxed text-[var(--color-fg)]">
        <strong className="text-[var(--color-nv-bright)]">{step + 1} · {STEPS[step].name}.</strong> {STEPS[step].text}
      </figcaption>
    </figure>
  );
}
