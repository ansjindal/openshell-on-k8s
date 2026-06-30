"use client";
import { useState, type ReactNode } from "react";

// Interactive OpenShell runtime diagram. Two lanes (the agent path + the guardrail
// path) inside the OpenShell box, matching the NVIDIA deck. Toggle between the
// LOGICAL view ("what it is") and the KUBERNETES view ("what it becomes on the
// cluster") — the same components, two lenses. Click any component for detail.

const NV = "#76b900", PURPLE = "#a78bfa", BLUE = "#6f8fd0", GREEN = "#34d399",
      AMBER = "#e0a800", CYAN = "#22d3ee", RED = "#ef6b6b", SLATE = "#94a3b8";

type Comp = {
  id: string; label: string; sub: string; color: string; lane: "agent" | "guard";
  what: ReactNode;     // logical: what it is
  k8s: ReactNode;      // on Kubernetes: what it becomes
};

const COMPONENTS: Comp[] = [
  { id: "gw", label: "Gateway", sub: "control plane · gRPC :8080", color: NV, lane: "agent",
    what: <>The brain. A gRPC API that allocates sandboxes, mints each one a scoped identity, hosts the policy engine + inference router, and exposes the operator-facing <code>openshell</code> CLI.</>,
    k8s: <>The <code>openshell</code> gateway (Helm) + Service. Its <em>Kubernetes compute driver</em> watches the <code>agents.x-k8s.io</code> Sandbox CRD on k3s. Reached from the VM via NodePort <code>30808</code>.</> },
  { id: "sup", label: "Sandbox Supervisor", sub: "openshell-sandbox · per pod", color: PURPLE, lane: "agent",
    what: <>Sideloaded into <em>every</em> sandbox. It sets up the agent's isolated network namespace, exchanges a bootstrap token for a sandbox JWT, relays exec/SSH, and enforces the sandbox-side policy.</>,
    k8s: <>An <strong>init-container</strong> (<code>openshell-supervisor-install</code>) copies the <code>openshell-sandbox</code> binary into the pod; the <code>agent</code> container runs it. It calls <code>IssueSandboxToken</code> back to the gateway over the in-cluster Service.</> },
  { id: "harness", label: "Agent Harness", sub: "Definition · Memory · Skills", color: BLUE, lane: "agent",
    what: <>The agent itself: its <strong>Definition</strong> (who it is), <strong>Memory</strong> (the workspace), and <strong>Skills</strong> (what it can do). The default agent is OpenClaw, but any agent image works.</>,
    k8s: <>The <code>agent</code> container in the sandbox Pod, running the OpenClaw image <code>openclaw:latest</code>. Its workspace lives on a mounted PVC.</> },
  { id: "subs", label: "Sub-Agents", sub: "spawned on demand", color: GREEN, lane: "agent",
    what: <>Agents can spawn focused sub-agents (a recon agent, an incident responder) — each its own sandbox with its own identity and policy.</>,
    k8s: <>More <code>Sandbox</code> CRs → more Pods, each governed by the same gateway. <code>kubectl -n openshell get sandboxes</code> shows the whole fleet.</> },
  { id: "tools", label: "Accelerated Tooling", sub: "API · CLI · MCP", color: CYAN, lane: "agent",
    what: <>The capabilities the agent reaches <em>through the guardrail</em>: filesystem, search, NVIDIA Omniverse/CAD, a local model — via API, CLI, or MCP servers.</>,
    k8s: <>In-cluster Services (e.g. the Kubernetes API, Prometheus) and external endpoints, each only reachable if the sandbox's <em>policy</em> allows that binary→host path.</> },

  { id: "policy", label: "Policy Engine + Validator", sub: "deny-by-default", color: AMBER, lane: "guard",
    what: <>Every sandbox starts deny-all. Policy declares, per binary, which hosts/methods/paths are allowed. A draft <strong>validator</strong> can propose additions for a human to approve.</>,
    k8s: <>The per-binary/method/path schema applied at creation with <code>openshell sandbox create --policy</code> (or hot-reloaded). Layered with Kubernetes RBAC + the gVisor RuntimeClass.</> },
  { id: "net", label: "Network Guardrail", sub: "per-binary egress", color: RED, lane: "guard",
    what: <>Kernel-level egress control: <code>git → github.com ✓</code>, <code>curl → anywhere ✗</code>. Same host, per-binary — stops data exfil through unknown channels. Instant, no restart on policy change.</>,
    k8s: <>Enforced at the sandbox proxy inside the gVisor pod. Defense-in-depth with the policy engine above and the <code>gvisor</code> RuntimeClass below.</> },
  { id: "router", label: "Privacy Router", sub: "inference.local", color: CYAN, lane: "guard",
    what: <>Sandboxes call one URL — <code>inference.local</code>. The in-sandbox policy proxy <strong>injects the real backend key</strong>, so the agent never holds the upstream key.</>,
    k8s: <>Routes <code>inference.local</code> → <strong>LiteLLM</strong> (namespace <code>litellm</code>) → the upstream model API. Change the model once (<code>openshell inference set</code>) and it propagates to sandboxes.</> },
  { id: "model", label: "Model", sub: "via LiteLLM", color: SLATE, lane: "guard",
    what: <>Where inference actually runs: one OpenAI-compatible endpoint (LiteLLM) in front of the model — chosen centrally, invisible to the agent.</>,
    k8s: <>Default model <code>meta/llama-3.3-70b-instruct</code> via <code>https://integrate.api.nvidia.com/v1</code>, fronted by LiteLLM. Swap it in one place; sandboxes never see the key.</> },
];

export function OpenShellRuntime() {
  const [view, setView] = useState<"what" | "k8s">("what");
  const [sel, setSel] = useState<string>("gw");
  const active = COMPONENTS.find((c) => c.id === sel)!;
  const lane = (l: Comp["lane"]) => COMPONENTS.filter((c) => c.lane === l);

  const Chip = ({ c }: { c: Comp }) => (
    <button
      onClick={() => setSel(c.id)}
      className="flex-1 min-w-[130px] rounded-lg border px-3 py-2 text-left transition"
      style={{ borderColor: c.color, background: sel === c.id ? `${c.color}26` : "transparent",
               boxShadow: sel === c.id ? `0 0 0 1px ${c.color}` : "none", opacity: sel === c.id ? 1 : 0.8 }}
    >
      <div className="text-[13px] font-semibold" style={{ color: c.color }}>{c.label}</div>
      <div className="text-[10px] text-[var(--color-fg-mut)]">{c.sub}</div>
    </button>
  );

  return (
    <figure className="my-6 rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <figcaption className="text-sm text-[var(--color-fg-mut)]">Inside the OpenShell runtime — click a component</figcaption>
        <div className="inline-flex overflow-hidden rounded-md border border-[var(--color-line-2)] text-xs">
          {(["what", "k8s"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)}
              className="px-2.5 py-1 font-medium transition"
              style={{ background: view === v ? "var(--color-nv)" : "transparent",
                       color: view === v ? "#06080b" : "var(--color-fg-dim)" }}>
              {v === "what" ? "What it is" : "On Kubernetes"}
            </button>
          ))}
        </div>
      </div>

      {/* the OpenShell box: two lanes */}
      <div className="rounded-xl border-2 p-3" style={{ borderColor: NV }}>
        <div className="mb-2 text-[11px] font-bold" style={{ color: NV }}>NVIDIA OpenShell</div>
        <div className="mb-1 text-[10px] uppercase tracking-wide text-[var(--color-fg-mut)]">Agent path</div>
        <div className="flex flex-wrap items-stretch gap-2">
          {lane("agent").map((c, i) => (
            <div key={c.id} className="flex flex-1 items-stretch gap-2">
              <Chip c={c} />
              {i < lane("agent").length - 1 && <span className="self-center text-[var(--color-fg-mut)]">→</span>}
            </div>
          ))}
        </div>
        <div className="mb-1 mt-3 text-[10px] uppercase tracking-wide text-[var(--color-fg-mut)]">Guardrail path</div>
        <div className="flex flex-wrap items-stretch gap-2">
          {lane("guard").map((c, i) => (
            <div key={c.id} className="flex flex-1 items-stretch gap-2">
              <Chip c={c} />
              {i < lane("guard").length - 1 && <span className="self-center text-[var(--color-fg-mut)]">→</span>}
            </div>
          ))}
        </div>
      </div>

      {/* detail panel */}
      <div className="mt-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-bg-2)] p-4 text-sm text-[var(--color-fg-dim)]">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-xs font-semibold" style={{ color: active.color }}>{active.label}</span>
          <span className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                style={{ background: view === "k8s" ? "#6f8fd033" : `${NV}22`, color: view === "k8s" ? BLUE : NV }}>
            {view === "k8s" ? "on Kubernetes" : "what it is"}
          </span>
        </div>
        <div>{view === "k8s" ? active.k8s : active.what}</div>
      </div>
      <p className="mt-2 text-[11px] text-[var(--color-fg-mut)]">
        Underneath it all: the open-source <strong>kubernetes-sigs/agent-sandbox</strong> <code>Sandbox</code> CRD + controller, which reconciles each CR into a Pod. OpenShell builds the gateway, supervisor, policy, and router on top.
      </p>
    </figure>
  );
}
