// Guided tours over a figure from docs/*.svg: each path lights up its boxes
// (data-node names) and arrows (data-flow tags set in docs/src), and numbered
// markers sit on the picture where each step happens (x, y in the SVG's own
// coordinates; architecture.svg is 1600 x 1090).
export type TourStep = { x: number; y: number; title: string; text: string };
export type TourPath = { title: string; intro: string; flow: string; nodes: string[]; steps: TourStep[] };

export const FIGURE_TOURS: Record<string, TourPath[]> = {
  architecture: [
    {
      title: "How you reach the lab", flow: "1",
      intro: "Everything you open in a browser comes in through two Brev links and Envoy; the CLI has its own door.",
      nodes: ["Browser", "Brev Secure Link", "socat", "Envoy Gateway", "Training site", "Keycloak", "Grafana", "OpenShell Console", "openshell CLI", "OpenShell gateway 0.1.7"],
      steps: [
        { x: 24, y: 100, title: "Browser", text: "You open one of the lab's Brev secure links." },
        { x: 230, y: 96, title: "Brev secure links", text: "Two links: one for this training site, Keycloak and Grafana; one for the OpenShell Console." },
        { x: 250, y: 228, title: "socat", text: "On the VM, socat forwards host ports 3001 and 3002 into the k3s cluster." },
        { x: 72, y: 372, title: "Envoy Gateway", text: "Routes by path and host: / to this site, /auth to Keycloak, /grafana to Grafana, the console host to the Console." },
        { x: 88, y: 548, title: "OpenShell Console", text: "Signs you in through Keycloak (oauth2-proxy) and calls the gateway with your token." },
        { x: 40, y: 228, title: "openshell CLI", text: "The Cluster shell's CLI skips all of that: it reaches the gateway directly on NodePort 30808 with an operator certificate." },
      ],
    },
    {
      title: "How a sandbox is made", flow: "2",
      intro: "One request to the gateway becomes a pair of pods in the workspace's namespace.",
      nodes: ["openshell CLI", "OpenShell Console", "OpenShell gateway 0.1.7", "agent-sandbox controller", "Kyverno", "cert-manager", "agent-0", "agent-1", "lab-a", "workload pod", "supervisor pod", "more sandboxes"],
      steps: [
        { x: 40, y: 228, title: "You ask", text: "From the CLI, or the Console with your Keycloak token, you ask for a sandbox: a name, a policy, its providers." },
        { x: 88, y: 660, title: "The gateway", text: "Checks who you are, stores the sandbox and its policy, and decides which workspace it belongs to." },
        { x: 472, y: 510, title: "The workspace namespace", text: "In managed mode the gateway creates the workspace's namespace (openshell-lab-default) and starts the supervisor pod in it." },
        { x: 486, y: 890, title: "The controller", text: "The gateway writes a Sandbox resource; the agent-sandbox controller turns it into the workload pod." },
        { x: 826, y: 890, title: "Kyverno", text: "Checks the pod on admission: no host network, no host PID, no host IPC." },
        { x: 676, y: 566, title: "A pair, Ready", text: "Workload pod and supervisor pod, side by side. agent-1 and lab-a (in team-a's namespace) are made the same way." },
        { x: 88, y: 890, title: "cert-manager", text: "Issued the certificates the gateway and the CLI use for mTLS." },
      ],
    },
    {
      title: "How a request flows", flow: "3",
      intro: "What happens when the agent calls the model, and why nothing else gets out.",
      nodes: ["agent-0", "workload pod", "supervisor pod", "LiteLLM", "Upstream model API"],
      steps: [
        { x: 688, y: 598, title: "The agent asks", text: "The agent in the workload pod makes a request. It holds only a placeholder key." },
        { x: 884, y: 640, title: "The only way out", text: "A NetworkPolicy lets the workload pod reach its own supervisor and nothing else." },
        { x: 924, y: 598, title: "The supervisor decides", text: "It checks the request against the policy: host, port, program, and for REST the method and path. No match: refused and logged." },
        { x: 1210, y: 640, title: "LiteLLM", text: "A model call matches the litellm provider's rules, so the supervisor adds the real key and forwards it." },
        { x: 1210, y: 1014, title: "The model", text: "LiteLLM calls the upstream model API over HTTPS. Only LiteLLM ever holds that key." },
      ],
    },
    {
      title: "Where the evidence goes", flow: "4",
      intro: "Every decision is recorded outside the sandbox, where the agent can't touch it.",
      nodes: ["supervisor pod", "Alloy", "Loki", "Tempo", "Grafana", "Prometheus", "OpenShell gateway 0.1.7"],
      steps: [
        { x: 924, y: 598, title: "OCSF events", text: "The supervisor writes every allow and deny as an OCSF event in its log." },
        { x: 1404, y: 400, title: "Alloy", text: "Collects the pods' logs across the cluster…" },
        { x: 978, y: 400, title: "Loki", text: "…and stores them in Loki, queryable by sandbox, namespace and verdict." },
        { x: 826, y: 400, title: "Tempo", text: "The agent's own traces, relayed by its supervisor, and the gateway's spans." },
        { x: 1110, y: 400, title: "Grafana", text: "Reads Loki, Tempo and Prometheus. You'll query the audit trail there in Module 4." },
      ],
    },
  ],
};
