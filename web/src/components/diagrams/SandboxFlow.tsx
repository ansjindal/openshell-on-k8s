import { ArchExplorer } from "./ArchExplorer";

const NV = "#76b900", PURPLE = "#a78bfa", BLUE = "#6f8fd0", GREEN = "#34d399", AMBER = "#e0a800";

export function SandboxFlow() {
  return (
    <ArchExplorer
      flow
      title="How a new sandbox is born — click each step"
      nodes={[
        { id: "req", label: "1 · Request", sub: "openshell CLI  or  Sandbox CR", color: BLUE, detail: <>You declare a desired sandbox. Two ways: call the <strong>OpenShell gateway</strong> (<code>openshell sandbox create</code>, NodePort <code>30808</code>) — which writes the CR for you — or apply a <code>Sandbox</code> CR with <code>kubectl</code> directly. Either way the desired state lands as a <code>sandboxes.agents.x-k8s.io</code> object.</> },
        { id: "reconcile", label: "2 · Reconcile", sub: "agent-sandbox controller", color: NV, detail: <>The <strong>agent-sandbox controller</strong> (kubernetes-sigs/agent-sandbox) watches Sandbox CRs. OpenShell's <strong>compute driver</strong> watches too. When a new CR appears, the controller builds the Pod from the CR's <code>podTemplate</code>.</> },
        { id: "schedule", label: "3 · Schedule", sub: "RuntimeClass gvisor · RBAC · Kyverno", color: AMBER, detail: <>k3s schedules the pod under its guardrails: the <code>gvisor</code> RuntimeClass (kernel isolation), the namespace RBAC, and — if enabled — the Kyverno <code>require-gvisor</code> admission policy. The sandbox can only do what policy allows.</> },
        { id: "run", label: "4 · Run", sub: "the agent boots", color: PURPLE, detail: <>The pod starts; the supervisor sets up the agent's isolated netns and the OpenClaw agent comes up inside it reading its workspace + config. The Sandbox CR's status flips to Ready.</> },
        { id: "use", label: "5 · Use", sub: "exec in · or run a task", color: GREEN, detail: <>Now you interact: <code>./scripts/fleet shell agent-0</code> or <code>openshell sandbox exec</code> to get inside, or <code>./scripts/fleet task "…"</code> to hand it work. Delete the CR (or <code>fleet down</code>) and the controller tears the pod down.</> },
      ]}
    />
  );
}
