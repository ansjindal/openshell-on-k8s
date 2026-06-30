"use client";
import type { ReactNode } from "react";

// End-to-end flow: how a request travels from the browser all the way to the
// model, and how an agent sandbox is born. Read top-to-bottom; each stage is a
// numbered lane of actor → action → actor.

const NV = "#76b900", BLUE = "#6f8fd0", PURPLE = "#a78bfa", AMBER = "#e0a800",
      CYAN = "#22d3ee", SLATE = "#94a3b8";

function Pill({ c, title, sub }: { c: string; title: string; sub?: string }) {
  return (
    <div className="rounded-lg border px-2.5 py-1.5 text-center" style={{ borderColor: c, background: `${c}1a` }}>
      <div className="text-[12px] font-semibold leading-tight" style={{ color: c }}>{title}</div>
      {sub && <div className="text-[9.5px] text-[var(--color-fg-mut)]">{sub}</div>}
    </div>
  );
}

function Arrow({ label }: { label?: string }) {
  return (
    <div className="flex shrink-0 flex-col items-center justify-center px-0.5 text-[var(--color-fg-mut)]">
      {label && <span className="mb-0.5 whitespace-nowrap text-[8.5px] leading-none">{label}</span>}
      <span className="text-base leading-none">→</span>
    </div>
  );
}

function Lane({ n, color, title, children }: { n: number; color: string; title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-bg-2)] p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold"
          style={{ background: color, color: "#06080b" }}>{n}</span>
        <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color }}>{title}</span>
      </div>
      <div className="flex flex-wrap items-stretch gap-1.5 [&>div]:flex-1 [&>div]:min-w-[88px]">{children}</div>
    </div>
  );
}

export function EndToEndFlow() {
  return (
    <figure className="my-6 rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
      <figcaption className="mb-3 text-sm text-[var(--color-fg-mut)]">
        End-to-end flow — one public URL in, a sandboxed agent out, the API key never leaves the proxy.
      </figcaption>

      <div className="space-y-2">
        <Lane n={1} color={BLUE} title="Access — one host via Envoy">
          <Pill c={SLATE} title="Browser" sub="you" />
          <Arrow label="https" />
          <Pill c={BLUE} title="Envoy ingress" sub="one public URL" />
          <Arrow label="path-routed" />
          <Pill c={NV} title="Lessons · Console" sub="/  ·  /console" />
          <Pill c={AMBER} title="Grafana · Keycloak" sub="/grafana · /auth" />
        </Lane>

        <Lane n={2} color={AMBER} title="Sign in — Keycloak SSO">
          <Pill c={NV} title="Console / Grafana" sub="protected UI" />
          <Arrow label="OIDC redirect" />
          <Pill c={AMBER} title="Keycloak" sub="realm: openshell" />
          <Arrow label="JWT + roles" />
          <Pill c={NV} title="Authorized session" sub="admin / user" />
        </Lane>

        <Lane n={3} color={NV} title="Create — sandbox lifecycle">
          <Pill c={NV} title="Console / CLI" sub="create sandbox" />
          <Arrow label="gRPC · mTLS" />
          <Pill c={NV} title="OpenShell gateway" sub="ns: openshell" />
          <Arrow label="writes" />
          <Pill c={BLUE} title="Sandbox CR" sub="agents.x-k8s.io" />
          <Arrow label="reconcile" />
          <Pill c={PURPLE} title="Agent pod" sub="ns: openshell-sandboxes" />
        </Lane>

        <Lane n={4} color={PURPLE} title="Think — credential-isolated inference">
          <Pill c={PURPLE} title="Agent code" sub="in the pod" />
          <Arrow label="inference.local" />
          <Pill c={AMBER} title="Supervisor proxy" sub="injects the key" />
          <Arrow label="OpenAI API" />
          <Pill c={BLUE} title="LiteLLM" sub="ns: litellm" />
          <Arrow label="upstream" />
          <Pill c={SLATE} title="Model API" sub="NVIDIA / OpenAI / …" />
        </Lane>

        <Lane n={5} color={CYAN} title="Observe & guard — always on">
          <Pill c={PURPLE} title="Pods & gateway" sub="metrics · logs" />
          <Arrow label="scrape / ship" />
          <Pill c={CYAN} title="Prometheus · Loki" sub="ns: monitoring" />
          <Arrow label="visualize" />
          <Pill c={AMBER} title="Grafana" sub="dashboards" />
          <Pill c={NV} title="Kyverno · gVisor" sub="admission + kernel isolation" />
        </Lane>
      </div>

      <div className="mt-3 rounded-lg border-l-2 pl-2 text-[12px] text-[var(--color-fg-dim)]" style={{ borderColor: NV }}>
        The agent calls <code>https://inference.local</code> — the in-pod supervisor proxy holds the real
        credential and forwards to LiteLLM, so compromised agent code can never read the model API key.
      </div>
    </figure>
  );
}
