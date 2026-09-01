"use client";
import { useState, type ReactNode } from "react";

// Detailed, interactive "OpenShell on Kubernetes" deployment. Click any object to see
// what it is, plus how THIS setup maps to it. Grouped by where things actually live:
// external clients, the openshell namespace (gateway + its state), the agent-sandbox
// controller, and the sandbox pods (in their own openshell-sandboxes namespace).
// Rendered as one real SVG: namespace groupings are drawn <rect>s, relationships are
// drawn <path> connectors with arrowheads clipped to each box's border.

const NV = "#76b900", BLUE = "#6f8fd0", PURPLE = "#a78bfa", AMBER = "#e0a800",
      GREEN = "#34d399", SLATE = "#94a3b8", CYAN = "#22d3ee", RED = "#ef6b6b";

type N = { id: string; label: string; sub?: string; color: string; what: ReactNode; ours: ReactNode };

const NODES: Record<string, N> = {
  cli: { id: "cli", label: "CLI / SDK / TUI", sub: "openshell …", color: SLATE,
    what: <>The operator surface. <code>openshell gateway add</code>, <code>sandbox create</code>, <code>policy set</code>, <code>inference set</code>. Authenticates with an mTLS client cert + (optionally) an OIDC JWT.</>,
    ours: <>Installed on the VM and registered against the gateway over NodePort <code>30808</code>. The chart terminates mTLS by default (0.0.71+) — <code>openshell gateway add --local</code> fetches its client cert from the <code>openshell-client-tls</code> Secret first (no OIDC in this single-node setup).</> },
  oidc: { id: "oidc", label: "OIDC Identity Provider", sub: "Keycloak / Entra ID", color: AMBER,
    what: <>Issues JWTs with role claims so the gateway can do per-method authorization (admin vs read-only user).</>,
    ours: <>Keycloak <strong>is</strong> deployed (realm <code>openshell</code>) and gates the browser UIs — the console and Grafana via the Envoy ingress (OIDC SSO). The gateway itself still runs unauthenticated (<code>allowUnauthenticatedUsers</code>, dev) to avoid a boot-time issuer dependency, so the CLI works with no SSO.</> },
  grpcroute: { id: "grpcroute", label: "Service", sub: "NodePort :30808", color: BLUE,
    what: <>Inbound gRPC reaches the gateway through a Service (and, with Gateway API, a GRPCRoute on an Envoy Gateway for edge TLS + path routing).</>,
    ours: <>A plain Service exposed as NodePort <code>30808</code> so the in-VM shell and the <code>openshell</code> CLI can reach it. (No Envoy — that's an optional add-on.)</> },
  gw: { id: "gw", label: "Gateway", sub: "API · state · policy · inference", color: NV,
    what: <>The control plane. Serves the gRPC API, stores provider creds, delivers policy, hosts the inference router, and <strong>authenticates each sandbox's supervisor over mTLS</strong>.</>,
    ours: <>The <code>openshell</code> gateway (Helm chart <code>0.0.116</code>) in namespace <code>openshell</code>. Its Kubernetes compute driver watches the Sandbox CRD on k3s. <code>server.disableTls</code> is unconditionally <code>false</code> — mTLS is always on.</> },
  pvc: { id: "pvc", label: "PVC", sub: "durable state", color: GREEN,
    what: <>Persists the gateway's SQLite DB (sandbox registry, policy revisions, provider config) across restarts.</>,
    ours: <>Bound via k3s's built-in <code>local-path</code> provisioner on the single node.</> },
  secrets: { id: "secrets", label: "Secrets", sub: "mTLS + JWT signing", color: RED,
    what: <>The gateway-minted sandbox-JWT signing keys + the mTLS PKI used for the supervisor handshake and exec/SSH relay.</>,
    ours: <>The mTLS trio (<code>openshell-ca-tls</code>, <code>-server-tls</code>, <code>-client-tls</code>) is cert-manager-issued, not the chart's built-in <code>pkiInitJob</code> — see the <strong>pkiInitJob</strong> node. <code>openshell-client-tls</code> is also copied into <code>openshell-sandboxes</code> for sandbox pods, since Secrets don't cross namespaces.</> },
  rbac: { id: "rbac", label: "RBAC", sub: "SA + Role bindings", color: PURPLE,
    what: <>The gateway + sandbox ServiceAccounts and their Roles — what the compute driver may do (create Sandboxes, read pods) and what each sandbox's SA may do.</>,
    ours: <>Plain Kubernetes RBAC on k3s. Pod-level isolation comes from the <code>gvisor</code> RuntimeClass + (optional) Kyverno admission policy.</> },
  pki: { id: "pki", label: "pkiInitJob / cert-manager", sub: "cert bootstrap", color: CYAN,
    what: <>A pre-install hook (<code>openshell-gateway generate-certs</code>) that creates the server + client mTLS Secrets in-cluster — or, when <code>certManager.enabled</code>, cert-manager Issuers/Certificates for auto-rotation instead (the hook then only mints the JWT signing key).</>,
    ours: <><strong>cert-manager is installed</strong> (a new role, before the gateway) and <code>certManager.enabled: true</code> is set — showcasing that path over the built-in self-signed job. <code>pkiInitJob</code> still runs, but only for the JWT signing key.</> },
  ctrl: { id: "ctrl", label: "agent-sandbox controller", sub: "agents.x-k8s.io · CRDs", color: BLUE,
    what: <>The kubernetes-sigs/agent-sandbox operator. Reconciles each <code>Sandbox</code> CR into a Pod (+ PVC).</>,
    ours: <>Deployed by Ansible alongside the gateway (release <code>v1.0.0</code>); watches <code>sandboxes.agents.x-k8s.io</code> (<code>v1beta1</code>) on the cluster.</> },
  pod: { id: "pod", label: "Sandbox Pod", sub: "supervisor + agent · gVisor", color: PURPLE,
    what: <>Each sandbox is a Pod with the <strong>supervisor</strong> (sideloaded init-container) wrapping the <strong>agent</strong> container (OpenClaw, or another agent). The supervisor dials the gateway over mTLS and enforces the L7 policy proxy.</>,
    ours: <>Created by <code>openshell sandbox create</code> in namespace <code>openshell-sandboxes</code> (separate from the gateway's <code>openshell</code>), on image <code>openclaw:latest</code>, pinned to <code>RuntimeClass: gvisor</code>.</> },
  guard: { id: "guard", label: "Network Guardrail + Privacy Router", sub: "egress + inference.local", color: AMBER,
    what: <>Every outbound connection is checked (deny-by-default, per-binary). The privacy router sends <code>inference.local</code> to a model proxy (LiteLLM), stripping creds + injecting the real key.</>,
    ours: <>Routes <code>inference.local</code> → LiteLLM (namespace <code>litellm</code>) → the upstream model API. The agent never holds the key.</> },
  addons: { id: "addons", label: "Cluster add-ons", sub: "Envoy · Keycloak · Kyverno · monitoring", color: SLATE,
    what: <>Envoy Gateway (Gateway API + GRPCRoute), Keycloak (OIDC SSO), Kyverno (admission guardrails), and a monitoring stack.</>,
    ours: <>Envoy Gateway, Keycloak, and the monitoring stack (Prometheus / Grafana / Loki / Alloy / Tempo) <strong>are</strong> deployed; Kyverno <code>require-gvisor</code> is on. Headlamp is not deployed.</> },
};

type Box = { x: number; y: number; w: number; h: number };

// Fixed layout in SVG units — a diagram, not a reflowing flexbox. Coordinates
// are hand-placed once; every node/edge below just references them.
const W = 800, H = 460;

const POS: Record<string, Box> = {
  cli:       { x: 20,  y: 60,  w: 140, h: 44 },
  oidc:      { x: 20,  y: 130, w: 140, h: 44 },
  grpcroute: { x: 330, y: 54,  w: 150, h: 34 },
  gw:        { x: 330, y: 100, w: 150, h: 40 },
  pvc:       { x: 224, y: 158, w: 80,  h: 40 },
  secrets:   { x: 318, y: 158, w: 80,  h: 40 },
  rbac:      { x: 412, y: 158, w: 80,  h: 40 },
  pki:       { x: 506, y: 158, w: 80,  h: 40 },
  ctrl:      { x: 310, y: 250, w: 190, h: 40 },
  pod:       { x: 330, y: 316, w: 150, h: 40 },
  guard:     { x: 310, y: 384, w: 190, h: 40 },
  addons:    { x: 650, y: 100, w: 130, h: 44 },
};

const EDGES: { from: string; to: string; label?: string; dashed?: boolean }[] = [
  { from: "cli", to: "grpcroute", label: "gRPC" },
  { from: "oidc", to: "gw", label: "JWT (optional)", dashed: true },
  { from: "grpcroute", to: "gw" },
  { from: "gw", to: "pvc" },
  { from: "gw", to: "secrets" },
  { from: "gw", to: "rbac" },
  { from: "gw", to: "pki" },
  { from: "gw", to: "ctrl", label: "writes Sandbox CR" },
  { from: "ctrl", to: "pod", label: "reconciles" },
  { from: "gw", to: "pod", label: "mTLS supervisor", dashed: true },
  { from: "pod", to: "guard" },
  { from: "addons", to: "gw", label: "SSO · ingress", dashed: true },
];

// Where a ray from a box's center toward (tx, ty) exits that box's border —
// so connectors land cleanly on each box's edge instead of its center.
function borderPoint(b: Box, tx: number, ty: number) {
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  const dx = tx - cx, dy = ty - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const scale = Math.min(dx !== 0 ? b.w / 2 / Math.abs(dx) : Infinity, dy !== 0 ? b.h / 2 / Math.abs(dy) : Infinity);
  return { x: cx + dx * scale, y: cy + dy * scale };
}
function boxCenter(b: Box) { return { x: b.x + b.w / 2, y: b.y + b.h / 2 }; }

export function OpenShellOnK8s() {
  const [sel, setSel] = useState("gw");
  const a = NODES[sel];

  return (
    <figure className="my-6 rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
      <figcaption className="mb-3 text-sm text-[var(--color-fg-mut)]">OpenShell on Kubernetes — click any object (detail shows how <em>this</em> setup maps to it)</figcaption>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
        <defs>
          <marker id="osk-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-fg-mut)" />
          </marker>
        </defs>

        {/* namespace / cluster groupings, drawn first so nodes sit on top */}
        <rect x={190} y={20} width={430} height={412} rx={12} fill="none" stroke={SLATE} strokeWidth={1.5} strokeDasharray="5 4" />
        <foreignObject x={200} y={26} width={260} height={14}><div className="text-[9px] font-bold uppercase tracking-wide" style={{ color: SLATE }}>k3s cluster (single node)</div></foreignObject>

        <rect x={210} y={44} width={390} height={186} rx={10} fill="none" stroke={NV} strokeWidth={1.5} />
        <foreignObject x={218} y={48} width={190} height={14}><div className="text-[9px] font-bold" style={{ color: NV }}>ns: openshell</div></foreignObject>

        <rect x={210} y={300} width={390} height={70} rx={10} fill="none" stroke={PURPLE} strokeWidth={1.5} />
        <foreignObject x={218} y={304} width={220} height={14}><div className="text-[9px] font-bold" style={{ color: PURPLE }}>ns: openshell-sandboxes</div></foreignObject>

        {/* edges */}
        {EDGES.map((e) => {
          const fromBox = POS[e.from], toBox = POS[e.to];
          const toC = boxCenter(toBox), fromC = boxCenter(fromBox);
          const p1 = borderPoint(fromBox, toC.x, toC.y);
          const p2 = borderPoint(toBox, fromC.x, fromC.y);
          const midX = (p1.x + p2.x) / 2, midY = (p1.y + p2.y) / 2;
          return (
            <g key={`${e.from}-${e.to}`}>
              <path
                d={`M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`}
                stroke="var(--color-fg-mut)" strokeWidth={1.3} fill="none"
                strokeDasharray={e.dashed ? "3 3" : undefined}
                markerEnd="url(#osk-arrow)" opacity={0.65}
              />
              {e.label && (
                <foreignObject x={midX - 55} y={midY - 16} width={110} height={14}>
                  <div className="rounded bg-[var(--color-panel)] px-1 text-center text-[8px] leading-none text-[var(--color-fg-mut)]">{e.label}</div>
                </foreignObject>
              )}
            </g>
          );
        })}

        {/* nodes */}
        {Object.entries(POS).map(([id, { x, y, w, h }]) => {
          const n = NODES[id];
          const isSel = sel === id;
          return (
            <foreignObject key={id} x={x} y={y} width={w} height={h}>
              <button
                onClick={() => setSel(id)}
                className="h-full w-full rounded-lg border px-2 py-1 text-left transition"
                style={{
                  borderColor: n.color,
                  background: isSel ? `${n.color}26` : "var(--color-bg-2)",
                  boxShadow: isSel ? `0 0 0 1px ${n.color}` : "none",
                }}
              >
                <div className="text-[11px] font-semibold leading-tight" style={{ color: n.color }}>{n.label}</div>
                {n.sub && <div className="text-[8.5px] leading-tight text-[var(--color-fg-mut)]">{n.sub}</div>}
              </button>
            </foreignObject>
          );
        })}
      </svg>

      <div className="mt-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-bg-2)] p-4 text-sm text-[var(--color-fg-dim)]">
        <div className="mb-1 text-xs font-semibold" style={{ color: a.color }}>{a.label}</div>
        <div className="mb-2">{a.what}</div>
        <div className="rounded border-l-2 pl-2 text-[13px]" style={{ borderColor: NV }}>
          <span className="text-[10px] font-semibold uppercase" style={{ color: NV }}>in this setup&nbsp;</span>{a.ours}
        </div>
      </div>
    </figure>
  );
}
