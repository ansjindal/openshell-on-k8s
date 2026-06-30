import { ArchExplorer } from "./ArchExplorer";

const NV = "#76b900", BLUE = "#6f8fd0", PURPLE = "#a78bfa", CYAN = "#22d3ee", AMBER = "#e0a800";

export function SecurityLayers() {
  return (
    <ArchExplorer
      title="Defense in depth — what bounds the agent (click each layer)"
      nodes={[
        { id: "ns", label: "Namespace + RBAC", sub: "scoped ServiceAccount", color: BLUE, detail: <>Every sandbox runs in the <code>openshell</code> namespace with a scoped ServiceAccount. RBAC decides which Kubernetes verbs that identity may use — by default, almost nothing outside its own sandbox.</> },
        { id: "gvisor", label: "gVisor (runsc)", sub: "RuntimeClass gvisor", color: PURPLE, detail: <>The headline isolation. Every sandbox pod runs under <code>RuntimeClass: gvisor</code>, so syscalls hit the <strong>runsc user-space kernel</strong> instead of the host kernel. A container escape lands inside gVisor, not on the node.</> },
        { id: "kyverno", label: "Kyverno policy", sub: "require-gvisor", color: AMBER, detail: <>An optional admission controller. The <code>require-gvisor</code> policy <strong>rejects any sandbox pod that isn't pinned to the gvisor RuntimeClass</strong> — so isolation can't be skipped, even by mistake.</> },
        { id: "l7", label: "OpenShell L7 policy", sub: "per-binary/method/path", color: NV, detail: <>The supervisor enforces a deny-by-default <strong>L7 policy</strong> per sandbox: which binaries may reach which hosts, methods, and paths. Far finer-grained than a network policy — a hijacked agent still can't exfiltrate through an unexpected binary.</> },
        { id: "cred", label: "Credential isolation", sub: "inference.local", color: CYAN, detail: <>The agent calls <code>https://inference.local</code> and never holds the model API key. The in-sandbox policy proxy injects the real credential on the way to LiteLLM. Compromise the agent, you still don't get the key.</> },
      ]}
    />
  );
}
