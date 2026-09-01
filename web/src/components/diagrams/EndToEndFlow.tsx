"use client";

// End-to-end flow: how a request travels from the browser all the way to the
// model, and how an agent sandbox is born. Read top-to-bottom; each stage is a
// numbered lane, rendered as one real SVG (foreignObject nodes + drawn <path>
// connectors with arrowheads — not CSS boxes with a unicode "→" between them).

const NV = "#76b900", BLUE = "#6f8fd0", PURPLE = "#a78bfa", AMBER = "#e0a800",
      CYAN = "#22d3ee", SLATE = "#94a3b8";

type Node = { title: string; sub?: string; color: string };
type Lane = { color: string; title: string; nodes: Node[]; edgeLabels: (string | undefined)[] };

const LANES: Lane[] = [
  {
    color: BLUE, title: "Access — one host via Envoy",
    nodes: [
      { title: "Browser", sub: "you", color: SLATE },
      { title: "Envoy ingress", sub: "one public URL", color: BLUE },
      { title: "Lessons · Console", sub: "/  ·  /console", color: NV },
      { title: "Grafana · Keycloak", sub: "/grafana · /auth", color: AMBER },
    ],
    edgeLabels: [undefined, "https", "path-routed"],
  },
  {
    color: AMBER, title: "Sign in — Keycloak SSO",
    nodes: [
      { title: "Console / Grafana", sub: "protected UI", color: NV },
      { title: "Keycloak", sub: "realm: openshell", color: AMBER },
      { title: "Authorized session", sub: "admin / user", color: NV },
    ],
    edgeLabels: [undefined, "OIDC redirect", "JWT + roles"],
  },
  {
    color: NV, title: "Create — sandbox lifecycle",
    nodes: [
      { title: "Console / CLI", sub: "create sandbox", color: NV },
      { title: "OpenShell gateway", sub: "ns: openshell", color: NV },
      { title: "Sandbox CR", sub: "agents.x-k8s.io", color: BLUE },
      { title: "Agent pod", sub: "ns: openshell-sandboxes", color: PURPLE },
    ],
    edgeLabels: [undefined, "gRPC · mTLS", "writes", "reconcile"],
  },
  {
    color: PURPLE, title: "Think — credential-isolated inference",
    nodes: [
      { title: "Agent code", sub: "in the pod", color: PURPLE },
      { title: "Supervisor proxy", sub: "injects the key", color: AMBER },
      { title: "LiteLLM", sub: "ns: litellm", color: BLUE },
      { title: "Model API", sub: "NVIDIA / OpenAI / …", color: SLATE },
    ],
    edgeLabels: [undefined, "inference.local", "OpenAI API", "upstream"],
  },
  {
    color: CYAN, title: "Observe & guard — always on",
    nodes: [
      { title: "Pods & gateway", sub: "metrics · logs", color: PURPLE },
      { title: "Prometheus · Loki", sub: "ns: monitoring", color: CYAN },
      { title: "Grafana", sub: "dashboards", color: AMBER },
      { title: "Kyverno · gVisor", sub: "admission + kernel isolation", color: NV },
    ],
    edgeLabels: [undefined, "scrape / ship", "visualize", undefined],
  },
];

// Fixed grid: every node lives in a slot of this width, so arrow endpoints are
// pure arithmetic — no runtime DOM measurement needed for a static diagram.
const SLOT_W = 190, SLOT_GAP = 34, NODE_H = 54, LANE_H = 128, PAD = 16;
const svgW = PAD * 2 + Math.max(...LANES.map((l) => l.nodes.length)) * SLOT_W + (Math.max(...LANES.map((l) => l.nodes.length)) - 1) * SLOT_GAP;
const svgH = LANES.length * LANE_H;

function laneNodeX(i: number) {
  return PAD + i * (SLOT_W + SLOT_GAP);
}

function NodeBox({ x, y, n }: { x: number; y: number; n: Node }) {
  return (
    <foreignObject x={x} y={y} width={SLOT_W} height={NODE_H}>
      <div
        className="flex h-full w-full flex-col items-center justify-center rounded-lg border px-2 text-center"
        style={{ borderColor: n.color, background: `${n.color}1a` }}
      >
        <div className="text-[12px] font-semibold leading-tight" style={{ color: n.color }}>{n.title}</div>
        {n.sub && <div className="text-[9.5px] leading-tight text-[var(--color-fg-mut)]">{n.sub}</div>}
      </div>
    </foreignObject>
  );
}

function Edge({ x1, x2, y, label, color }: { x1: number; x2: number; y: number; label?: string; color: string }) {
  const midY = y;
  return (
    <g>
      <path d={`M ${x1} ${midY} L ${x2} ${midY}`} stroke={color} strokeWidth={1.5} fill="none" markerEnd="url(#eef-arrow)" opacity={0.85} />
      {label && (
        <foreignObject x={Math.min(x1, x2)} y={midY - 20} width={Math.abs(x2 - x1)} height={16}>
          <div className="text-center text-[8.5px] leading-none text-[var(--color-fg-mut)]">{label}</div>
        </foreignObject>
      )}
    </g>
  );
}

export function EndToEndFlow() {
  return (
    <figure className="my-6 rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
      <figcaption className="mb-3 text-sm text-[var(--color-fg-mut)]">
        End-to-end flow — one public URL in, a sandboxed agent out, the API key never leaves the proxy.
      </figcaption>

      <svg viewBox={`0 0 ${svgW} ${svgH}`} width="100%" style={{ display: "block" }}>
        <defs>
          <marker id="eef-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-fg-mut)" />
          </marker>
        </defs>
        {LANES.map((lane, li) => {
          const y0 = li * LANE_H;
          const nodeY = y0 + 34;
          const midNodeY = nodeY + NODE_H / 2;
          return (
            <g key={lane.title}>
              <foreignObject x={0} y={y0} width={svgW} height={24}>
                <div className="flex items-center gap-2">
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold"
                    style={{ background: lane.color, color: "#06080b" }}
                  >
                    {li + 1}
                  </span>
                  <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: lane.color }}>{lane.title}</span>
                </div>
              </foreignObject>

              {lane.nodes.map((n, ni) => {
                const x = laneNodeX(ni);
                const elements = [<NodeBox key={`n${ni}`} x={x} y={nodeY} n={n} />];
                if (ni > 0) {
                  const prevX = laneNodeX(ni - 1) + SLOT_W;
                  elements.unshift(
                    <Edge key={`e${ni}`} x1={prevX} x2={x} y={midNodeY} label={lane.edgeLabels[ni]} color={lane.color} />
                  );
                }
                return elements;
              })}
            </g>
          );
        })}
      </svg>

      <div className="mt-3 rounded-lg border-l-2 pl-2 text-[12px] text-[var(--color-fg-dim)]" style={{ borderColor: NV }}>
        The agent calls <code>https://inference.local</code> — the in-pod supervisor proxy holds the real
        credential and forwards to LiteLLM, so compromised agent code can never read the model API key.
      </div>
    </figure>
  );
}
