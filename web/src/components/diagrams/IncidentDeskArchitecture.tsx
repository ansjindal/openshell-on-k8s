import { DIAGRAM as C } from "./palette";

// The Incident Desk: a real backend app (research-desk) drives a 7-agent governed fleet through a
// run lifecycle with TWO human gates. A coordinator triages → four investigators each read ONE
// telemetry backend (logs→Loki, metrics→Prometheus, traces→Tempo, changes→k8s/Gitea) → [findings
// gate ✋] → a synthesizer writes the RCA + runbook → [runbook gate ✋] → a sender mails it. The
// approved remediation lands by ONE of two paths: a direct ConfigMap patch + roll (orders-pool), or
// a GitOps PR a human merges → ArgoCD syncs → the app recovers (gitops-oom). Each agent is sealed:
// investigators reach only their one backend + inference; coordinator/synthesizer reach only the
// model; sender reaches only mail. Theme-aware (CSS vars + translucent accent fills).
export function IncidentDeskArchitecture() {
  const W = 980, H = 520;
  const GREEN = "#8fce46", VIOLET = "#a78bfa", AMBER = "#e0a23a", CYAN = "#34d4e0", BLUE = "#7aa2e3";
  const Node = ({ x, y, w, h = 50, cls, stroke, title, sub, dash }: { x: number; y: number; w: number; h?: number; cls: string; stroke: string; title: string; sub?: string; dash?: boolean }) => (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={10} className={cls} stroke={stroke} strokeWidth={1.6} strokeDasharray={dash ? "5 4" : undefined} />
      <text x={x + w / 2} y={y + (sub ? h / 2 - 1 : h / 2 + 4)} fontSize={12} className="id-ink" textAnchor="middle" fontWeight={700}>{title}</text>
      {sub && <text x={x + w / 2} y={y + h / 2 + 13} fontSize={9} className="id-sub" textAnchor="middle">{sub}</text>}
    </g>
  );
  const Arrow = ({ x1, y1, x2, y2, label, color, dash, lx, ly, marker }: { x1: number; y1: number; x2: number; y2: number; label?: string; color: string; dash?: boolean; lx?: number; ly?: number; marker: string }) => (
    <g>
      <path d={`M${x1},${y1} L${x2},${y2}`} stroke={color} strokeWidth={1.7} fill="none" markerEnd={`url(#${marker})`} strokeDasharray={dash ? "5 4" : undefined} opacity={dash ? 0.8 : 1} />
      {label && <text x={lx ?? (x1 + x2) / 2} y={ly ?? Math.min(y1, y2) - 6} fontSize={9} fill={color} textAnchor="middle" fontWeight={700}>{label}</text>}
    </g>
  );
  const ix = 392, iw = 196;                          // investigator column
  const investigators = [
    { y: 70, role: "logs 🔎", backend: "Loki only" },
    { y: 142, role: "metrics 📈", backend: "Prometheus only" },
    { y: 214, role: "traces 🧵", backend: "Tempo only" },
    { y: 286, role: "changes 🗂️", backend: "k8s / Gitea only" },
  ];
  return (
    <figure className="my-6 overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)]">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" fontFamily={C.font} role="img" aria-label="The Incident Desk: a 7-agent governed fleet with two human gates and two remediation paths">
        <style>{`
          .id-surface{fill:var(--color-panel);} .id-card{fill:var(--color-bg-2);}
          .id-ink{fill:var(--color-fg);} .id-sub{fill:var(--color-fg-mut);}
          .id-phase{fill:var(--color-fg-mut);letter-spacing:.08em;} .id-lane{fill:var(--color-fg);opacity:.025;}
          .id-violet{fill:${VIOLET};opacity:.15;} .id-green{fill:${GREEN};opacity:.14;}
          .id-amber{fill:${AMBER};opacity:.16;} .id-blue{fill:${BLUE};opacity:.16;}
        `}</style>
        <defs>
          <marker id="id_v" markerWidth="9" markerHeight="9" refX="6.5" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill={CYAN} /></marker>
          <marker id="id_g" markerWidth="9" markerHeight="9" refX="6.5" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill={GREEN} /></marker>
          <marker id="id_a" markerWidth="9" markerHeight="9" refX="6.5" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill={AMBER} /></marker>
          <marker id="id_s" markerWidth="9" markerHeight="9" refX="6.5" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill={C.sub} /></marker>
        </defs>
        <rect x={0} y={0} width={W} height={H} className="id-surface" />
        <rect x={12} y={36} width={156} height={400} rx={12} className="id-lane" />
        <rect x={188} y={36} width={176} height={400} rx={12} className="id-lane" />
        <rect x={372} y={36} width={236} height={400} rx={12} className="id-lane" />
        <rect x={628} y={36} width={158} height={400} rx={12} className="id-lane" />
        <rect x={806} y={36} width={162} height={400} rx={12} className="id-lane" />
        <text x={90} y={26} fontSize={10.5} className="id-phase" textAnchor="middle" fontWeight={800}>① TRIAGE</text>
        <text x={276} y={26} fontSize={10.5} className="id-phase" textAnchor="middle" fontWeight={800}>② INVESTIGATE</text>
        <text x={490} y={26} fontSize={10.5} className="id-phase" textAnchor="middle" fontWeight={800}>③ SYNTHESIZE</text>
        <text x={707} y={26} fontSize={10.5} className="id-phase" textAnchor="middle" fontWeight={800}>④ DELIVER</text>
        <text x={887} y={26} fontSize={10.5} className="id-phase" textAnchor="middle" fontWeight={800}>⑤ REMEDIATE</text>

        {/* triage: the coordinator (reads symptoms, plans one investigator per source) */}
        <Node x={26} y={172} w={132} h={64} cls="id-violet" stroke={VIOLET} title="coordinator 🧭" sub="triage · plan" />
        <text x={92} y={262} fontSize={9} className="id-sub" textAnchor="middle">inference only</text>
        <text x={92} y={275} fontSize={9} className="id-sub" textAnchor="middle">one hypothesis/source</text>

        {/* investigate: four sealed investigators, each scoped to ONE telemetry backend */}
        {investigators.map((a, i) => {
          const cy = a.y + 25;
          return (
            <g key={i}>
              <Node x={ix} y={a.y} w={iw} cls="id-green" stroke={C.nvidia} title={a.role} sub={a.backend} />
              <Arrow x1={158} y1={204} x2={ix} y2={cy} color={GREEN} marker="id_g" dash />
            </g>
          );
        })}
        <text x={276} y={200} fontSize={9} fill={GREEN} textAnchor="middle" fontWeight={700}>dispatch</text>
        <text x={276} y={350} fontSize={8.6} className="id-sub" textAnchor="middle">each reads its</text>
        <text x={276} y={362} fontSize={8.6} className="id-sub" textAnchor="middle">one backend +</text>
        <text x={276} y={374} fontSize={8.6} className="id-sub" textAnchor="middle">inference</text>

        {/* findings gate */}
        <rect x={384} y={360} width={212} height={30} rx={9} className="id-amber" stroke={AMBER} strokeWidth={1.6} />
        <text x={490} y={379} fontSize={10.5} className="id-ink" textAnchor="middle" fontWeight={700}>✋ findings gate — you approve</text>

        {/* synthesize: the no-extra-egress synthesizer → RCA + runbook */}
        <Node x={636} y={150} w={142} h={66} cls="id-violet" stroke={VIOLET} title="synthesizer 🧠" sub="RCA + runbook" />
        {investigators.map((a, i) => (
          <Arrow key={i} x1={ix + iw} y1={a.y + 25} x2={636} y2={176 + (i - 1.5) * 6} color={C.sub} marker="id_s" dash />
        ))}
        <text x={707} y={250} fontSize={9} className="id-sub" textAnchor="middle">inference only</text>
        <text x={707} y={262} fontSize={9} className="id-sub" textAnchor="middle">correlates findings</text>

        {/* runbook gate */}
        <rect x={632} y={360} width={150} height={30} rx={9} className="id-amber" stroke={AMBER} strokeWidth={1.6} />
        <text x={707} y={379} fontSize={10} className="id-ink" textAnchor="middle" fontWeight={700}>✋ runbook gate</text>

        {/* deliver: the sender (mail only) */}
        <Node x={820} y={150} w={134} h={58} cls="id-blue" stroke={BLUE} title="sender ✉️" sub="Mailpit (SMTP) only" />
        <Arrow x1={778} y1={183} x2={820} y2={179} color={C.sub} marker="id_s" />

        {/* remediate: TWO paths */}
        <text x={887} y={250} fontSize={9.4} className="id-ink" textAnchor="middle" fontWeight={700}>approved fix →</text>
        <rect x={812} y={262} width={150} height={70} rx={9} className="id-green" stroke={C.nvidia} strokeWidth={1.6} />
        <text x={887} y={284} fontSize={9.6} className="id-ink" textAnchor="middle" fontWeight={700}>A · direct patch</text>
        <text x={887} y={298} fontSize={8.6} className="id-sub" textAnchor="middle">ConfigMap + roll</text>
        <text x={887} y={310} fontSize={8.6} className="id-sub" textAnchor="middle">(orders-pool)</text>
        <text x={887} y={324} fontSize={8.4} className="id-sub" textAnchor="middle">→ orders-api recovers</text>
        <rect x={812} y={346} width={150} height={80} rx={9} className="id-amber" stroke={AMBER} strokeWidth={1.6} />
        <text x={887} y={368} fontSize={9.6} className="id-ink" textAnchor="middle" fontWeight={700}>B · GitOps</text>
        <text x={887} y={382} fontSize={8.6} className="id-sub" textAnchor="middle">PR → human merge</text>
        <text x={887} y={394} fontSize={8.6} className="id-sub" textAnchor="middle">→ ArgoCD sync</text>
        <text x={887} y={406} fontSize={8.6} className="id-sub" textAnchor="middle">(gitops-oom)</text>
        <text x={887} y={420} fontSize={8.4} className="id-sub" textAnchor="middle">→ catalog-api recovers</text>

        <text x={W / 2} y={H - 12} fontSize={10.2} className="id-sub" textAnchor="middle">A real backend app drives a 7-agent fleet — each agent sealed to one egress — through two human gates to one of two governed remediation paths.</text>
      </svg>
    </figure>
  );
}
