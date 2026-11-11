"use client";
// An animated scene: a board of boxes on the right, requests ("packets")
// travelling between them, and on the left the step's text, an optional YAML
// file with the lines that matter highlighted, and a console of what the
// supervisor logged. Steps advance with Next / Back; each step replays its
// requests and counts them (requests, allowed, blocked, breaches).
//   <Scene id="policy" />     specs live in lib/scenes.ts
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { SCENES, type SceneNode, type Packet } from "@/lib/scenes";

type Live = { key: number; pts: [number, number][]; t0: number; dur: number; stop: number; result: Packet["result"]; label?: string; done?: boolean };

const COL = { ok: "var(--color-nv-bright)", deny: "#e5484d", breach: "#ff8a3d" } as const;

function along(pts: [number, number][], f: number): [number, number] {
  const seg = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
  const total = seg.reduce((a, b) => a + b, 0);
  let d = Math.max(0, Math.min(1, f)) * total;
  for (let i = 0; i < seg.length; i++) {
    if (d <= seg[i] || i === seg.length - 1) {
      const r = seg[i] ? Math.min(1, d / seg[i]) : 0;
      return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * r, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * r];
    }
    d -= seg[i];
  }
  return pts[pts.length - 1];
}

function nodeAt(n: SceneNode, step: number) {
  if (n.from !== undefined && step < n.from) return null;
  if (n.until !== undefined && step >= n.until) return null;
  let v = { label: n.label, sub: n.sub, kind: n.kind };
  for (const c of n.changes ?? []) if (step >= c.at) v = { ...v, ...c };
  return { ...n, ...v, fresh: n.from === step || (n.changes ?? []).some((c) => c.at === step) };
}

export function Scene({ id }: { id: string }) {
  const sc = SCENES[id];
  const [step, setStep] = useState(0);
  const [packets, setPackets] = useState<Live[]>([]);
  const [log, setLog] = useState<{ text: string; result: Packet["result"] }[]>([]);
  const [count, setCount] = useState({ req: 0, ok: 0, deny: 0, breach: 0 });
  const [now, setNow] = useState(0);
  const timers = useRef<number[]>([]);
  const raf = useRef<number | null>(null);
  const key = useRef(0);

  const play = useCallback((s: number) => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    setPackets([]);
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    (sc?.steps[s]?.packets ?? []).forEach((p, i) => {
      const t = window.setTimeout(() => {
        const route = sc.routes[p.route];
        if (!route) return;
        const dur = reduce ? 1 : p.dur ?? 1500;
        const stop = p.result === "deny" ? p.stopAt ?? 0.5 : 1;
        const live: Live = { key: ++key.current, pts: route, t0: performance.now(), dur: dur * stop, stop, result: p.result, label: p.label };
        setPackets((ps) => [...ps.filter((x) => !x.done || performance.now() - x.t0 < x.dur + 1600), live]);
        setCount((c) => ({ ...c, req: c.req + 1 }));
        window.setTimeout(() => {
          setCount((c) => ({ ...c, ok: c.ok + (p.result === "ok" ? 1 : 0), deny: c.deny + (p.result === "deny" ? 1 : 0), breach: c.breach + (p.result === "breach" ? 1 : 0) }));
          if (p.log) setLog((l) => [...l.slice(-7), { text: p.log!, result: p.result }]);
        }, dur * stop);
      }, (reduce ? 0 : 900) * i + 250);
      timers.current.push(t);
    });
  }, [sc]);

  useEffect(() => { play(step); }, [step, play]);
  useEffect(() => {
    const tick = () => { setNow(performance.now()); raf.current = requestAnimationFrame(tick); };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); timers.current.forEach((t) => window.clearTimeout(t)); };
  }, []);

  if (!sc) return null;
  const cur = sc.steps[step];
  const go = (s: number) => { setStep(Math.max(0, Math.min(sc.steps.length - 1, s))); };
  const replay = () => { setLog([]); setCount({ req: 0, ok: 0, deny: 0, breach: 0 }); setStep(0); play(0); };
  const nodes = sc.nodes.map((n) => nodeAt(n, step)).filter(Boolean) as (SceneNode & { fresh: boolean })[];
  const hl = new Set<number>();
  cur.yaml?.forEach(([a, b]) => { for (let i = a; i <= b; i++) hl.add(i); });

  return (
    <div className="not-prose my-6 overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)]">
      {/* top bar: counters, as a scoreboard */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-[var(--color-line)] bg-[var(--color-ink2)] px-4 py-2 text-[12px]">
        <span className="font-semibold text-[var(--color-fg)]">{sc.title}</span>
        <span className="ml-auto text-[var(--color-fg-mut)]">Requests <b className="font-mono text-[var(--color-fg)]">{count.req}</b></span>
        <span className="text-[var(--color-fg-mut)]">Allowed <b className="font-mono text-[var(--color-nv-bright)]">{count.ok}</b></span>
        <span className="text-[var(--color-fg-mut)]">Blocked <b className="font-mono text-[#e5484d]">{count.deny}</b></span>
        {sc.breaches && <span className="text-[var(--color-fg-mut)]">Breaches <b className="font-mono text-[#ff8a3d]">{count.breach}</b></span>}
      </div>

      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        {/* left: the step, the file, the console */}
        <div className="flex min-w-0 flex-col gap-3 border-b border-[var(--color-line)] p-4 lg:border-b-0 lg:border-r">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-nv-bright)]">Step {step + 1} of {sc.steps.length}</div>
            <div className="mt-1 text-[17px] font-bold text-[var(--color-fg)]">{cur.title}</div>
            <p className="mt-1.5 text-[14px] leading-[22px] text-[var(--color-fg-dim)]">{cur.text}</p>
          </div>
          {sc.yaml && (
            <pre className="m-0 overflow-x-auto rounded-lg border border-[var(--color-code-bd)] bg-[var(--color-code-bg)] py-2 font-mono text-[12px] leading-[19px]">
              {sc.yaml.split("\n").map((line, i) => {
                const on = hl.has(i + 1);
                return (
                  <div key={i} className={`flex pr-3 transition-colors duration-300 ${on ? "bg-[rgba(118,185,0,0.14)]" : cur.yaml ? "opacity-45" : ""}`}
                    style={{ boxShadow: on ? "inset 3px 0 0 var(--color-nv)" : undefined }}>
                    <span className="w-8 shrink-0 select-none pr-2 text-right text-[var(--color-fg-mut)]">{i + 1}</span>
                    <span className={on ? "text-[var(--color-fg)]" : "text-[var(--color-fg-dim)]"}>{line || " "}</span>
                  </div>
                );
              })}
            </pre>
          )}
          <div className="min-h-[96px] rounded-lg border border-[var(--color-code-bd)] bg-[var(--color-term-bg)] px-3 py-2 font-mono text-[11.5px] leading-[18px]">
            <div className="mb-1 text-[var(--color-fg-mut)]">supervisor log</div>
            {log.length === 0 && <div className="text-[var(--color-fg-mut)]">…</div>}
            {log.map((l, i) => (
              <div key={i} className="truncate" style={{ color: l.result === "ok" ? "var(--color-term-fg)" : COL[l.result] }}>{l.text}</div>
            ))}
          </div>
        </div>

        {/* right: the board */}
        <div className="min-w-0 p-3">
          <svg viewBox={`0 0 ${sc.w} ${sc.h}`} className="block h-auto w-full" role="img" aria-label={cur.title}>
            <defs>
              <style>{`@keyframes scmarch{to{stroke-dashoffset:-22}} .sc-wire{animation:scmarch 1.2s linear infinite}`}</style>
            </defs>
            {nodes.filter((n) => n.kind === "group").map((n) => (
              <g key={n.id} style={{ transition: "opacity .5s" }}>
                <rect x={n.x} y={n.y} width={n.w} height={n.h} rx={10} fill="var(--color-ink2)" fillOpacity={0.7}
                  stroke={n.fresh ? "var(--color-nv-bright)" : "var(--color-line-2)"} strokeWidth={n.fresh ? 2 : 1.3} strokeDasharray="5 4" />
                <text x={n.x + 12} y={n.y + 19} fontSize={12.5} fontWeight={700} fill="var(--color-fg-dim)">{n.label}</text>
              </g>
            ))}
            {/* the paths this step's requests take, drawn under the boxes */}
            {[...new Set(cur.packets.map((p) => p.route))].map((r) => sc.routes[r] && (
              <polyline key={"r-" + r} points={sc.routes[r].map((p) => p.join(",")).join(" ")} fill="none"
                stroke="var(--color-fg-mut)" strokeOpacity={0.55} strokeWidth={1.5} strokeDasharray="5 6" className="sc-wire" />
            ))}
            {Object.entries(sc.wires ?? {}).filter(([, w]) => (w.from ?? 0) <= step && (w.until === undefined || step < w.until)).map(([k, w]) => (
              <polyline key={k} points={w.pts.map((p) => p.join(",")).join(" ")} fill="none" stroke="var(--color-line-2)" strokeWidth={1.6} strokeDasharray="6 5" className="sc-wire" />
            ))}
            {nodes.filter((n) => n.kind !== "group").map((n) => {
              const tone = n.kind === "deny" ? "#e5484d" : n.kind === "ext" ? "var(--color-info)" : n.kind === "accent" ? "var(--color-nv)" : n.kind === "warn" ? "#ff8a3d" : "var(--color-line-2)";
              const subs = n.sub ? n.sub.split("\n") : [];
              const y0 = n.y + (n.h - (14 + subs.length * 15)) / 2 + 12;
              return (
                <g key={n.id + (n.label ?? "")} style={{ animation: n.fresh ? "swapIn .5s ease" : undefined }}>
                  <rect x={n.x} y={n.y} width={n.w} height={n.h} rx={8} fill="var(--color-panel-2)" stroke={tone} strokeWidth={n.fresh ? 2.4 : 1.6}
                    style={n.fresh ? { filter: "drop-shadow(0 0 8px rgba(146,230,0,.45))" } : undefined} />
                  <text x={n.x + 11} y={y0} fontSize={13} fontWeight={700} fill="var(--color-fg)">{n.label}</text>
                  {subs.map((s, i) => <text key={i} x={n.x + 11} y={y0 + 15 * (i + 1)} fontSize={11.5} fill="var(--color-fg-dim)">{s}</text>)}
                </g>
              );
            })}
            {packets.map((p) => {
              const f = Math.min(1, (now - p.t0) / p.dur);
              const [x, y] = along(p.pts, f * p.stop);
              const ended = f >= 1;
              const age = now - p.t0 - p.dur;
              if (ended && age > 1500) return null;
              const c = !ended ? "var(--color-fg)" : COL[p.result];
              return (
                <g key={p.key} opacity={ended ? Math.max(0, 1 - age / 1500) : 1}>
                  <circle cx={x} cy={y} r={ended ? 8 : 6} fill={c} style={{ filter: `drop-shadow(0 0 5px ${c})` }} />
                  {ended && <text x={x} y={y + 4} fontSize={11} fontWeight={800} textAnchor="middle" fill="#0b0f05">{p.result === "ok" ? "✓" : p.result === "deny" ? "✕" : "!"}</text>}
                  {p.label && !ended && <text x={x + 10} y={y - 9} fontSize={10.5} fontWeight={700} fill="var(--color-fg)" stroke="var(--color-panel)" strokeWidth={3} paintOrder="stroke">{p.label}</text>}
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* controls */}
      <div className="flex items-center gap-2 border-t border-[var(--color-line)] bg-[var(--color-ink2)] px-4 py-2">
        <button onClick={() => go(step - 1)} disabled={step === 0}
          className="inline-flex items-center gap-1 rounded-md border border-[var(--color-line-2)] px-2.5 py-1 text-[12px] text-[var(--color-fg-dim)] hover:text-[var(--color-fg)] disabled:opacity-40"><ChevronLeft size={13} /> Back</button>
        <div className="flex flex-1 items-center justify-center gap-1.5">
          {sc.steps.map((s, i) => (
            <button key={i} onClick={() => go(i)} title={s.title}
              className={`h-2 rounded-full transition-all ${i === step ? "w-6 bg-[var(--color-nv)]" : i < step ? "w-2 bg-[var(--color-nv-dim)]" : "w-2 bg-[var(--color-line-2)]"}`} />
          ))}
        </div>
        <button onClick={() => play(step)} title="Play this step again"
          className="inline-flex items-center gap-1 rounded-md border border-[var(--color-line-2)] px-2.5 py-1 text-[12px] text-[var(--color-fg-dim)] hover:text-[var(--color-fg)]"><RotateCcw size={12} /> Replay</button>
        {step < sc.steps.length - 1 ? (
          <button onClick={() => go(step + 1)}
            className="inline-flex items-center gap-1 rounded-md border border-[var(--color-run-btn-line)] bg-[var(--color-run-btn)] px-3 py-1 text-[12px] font-bold text-[var(--color-nv-bright)]">Next <ChevronRight size={13} /></button>
        ) : (
          <button onClick={replay}
            className="inline-flex items-center gap-1 rounded-md border border-[var(--color-run-btn-line)] bg-[var(--color-run-btn)] px-3 py-1 text-[12px] font-bold text-[var(--color-nv-bright)]">Start over <RotateCcw size={12} /></button>
        )}
      </div>
    </div>
  );
}
