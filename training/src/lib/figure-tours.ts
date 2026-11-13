// Guided tours over a figure from docs/*.svg: each path lights up its boxes
// (data-node names) and arrows (data-flow tags set in docs/src), and numbered
// markers sit on the picture where each step happens (x, y in the SVG's own
// coordinates; architecture.svg is 1600 x 1090).
export type TourStep = { x: number; y: number; title: string; text: string };
// `all`: light the whole figure (no dimming); `zoom`: 1 shows it whole.
export type TourPath = { title: string; intro: string; flow: string; nodes: string[]; steps: TourStep[]; all?: boolean; zoom?: number };

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
      nodes: ["openshell CLI", "OpenShell Console", "OpenShell gateway 0.1.7", "agent-sandbox controller", "Kyverno", "cert-manager", "agent-0", "agent-1", "pi-agent", "workload pod", "supervisor pod", "more sandboxes"],
      steps: [
        { x: 40, y: 228, title: "You ask", text: "From the CLI, or the Console with your Keycloak token, you ask for a sandbox: a name, a policy, its providers." },
        { x: 88, y: 660, title: "The gateway", text: "Checks who you are, stores the sandbox and its policy, and decides which workspace it belongs to." },
        { x: 472, y: 510, title: "The workspace namespace", text: "In operator mode each workspace is a namespace prepared with the openshell-workspace chart (lab here); the gateway starts the supervisor pod in it." },
        { x: 486, y: 890, title: "The controller", text: "The gateway writes a Sandbox resource; the agent-sandbox controller turns it into the workload pod." },
        { x: 826, y: 890, title: "Kyverno", text: "Checks the pod on admission: no host network, no host PID, no host IPC." },
        { x: 676, y: 566, title: "A pair, Ready", text: "Workload pod and supervisor pod, side by side. agent-1, and your pi-agent in dev's namespace, are made the same way." },
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
        { x: 1110, y: 400, title: "Grafana", text: "Reads Loki, Tempo and Prometheus. You'll query the audit trail there in Module 2." },
      ],
    },
    {
      title: "The whole platform, together", flow: "all", all: true, zoom: 1, nodes: [],
      intro: "All four paths on one picture: how you come in, who decides, where agents run, how they reach the model, and where the evidence goes.",
      steps: [
        { x: 230, y: 96, title: "Coming in", text: "People reach the lab through two Brev links and Envoy; the VM's CLI talks to the gateway directly." },
        { x: 88, y: 660, title: "Deciding", text: "The OpenShell gateway, with Keycloak for people and cert-manager for certificates, decides who may do what and creates every sandbox." },
        { x: 676, y: 566, title: "Running", text: "Each workspace is a namespace with its sandboxes: one workload pod and one supervisor pod each." },
        { x: 1210, y: 640, title: "Reaching the model", text: "Every model call goes through the agent's supervisor to LiteLLM, the only place that holds the upstream key." },
        { x: 1110, y: 400, title: "Recording", text: "Every decision lands in Loki and every trace in Tempo, and Grafana reads them all." },
      ],
    },
  ],
};

// A figure read as a scroll flow (<FigRead>): each step lights its boxes
// (data-node names) and puts its number at x, y (the SVG's own coordinates).
export type ReadStep = { title: string; where?: string; text: string; nodes: string[]; x: number; y: number };
export type FigureRead = { title: string; intro: string; steps: ReadStep[]; outro?: { title: string; text: string } };

export const FIGURE_READS: Record<string, FigureRead> = {
  cluster: {
    title: "The stack, layer by layer",
    intro: "Everything in the picture runs on one Brev VM. Scroll down: each layer lights up in the picture as you read about it, from the way you come in to the agent you will deploy.",
    steps: [
      { title: "The VM", where: "your Brev instance", nodes: ["Browser", "Brev Secure Link", "socat", "Training site", "kubectl"], x: 395, y: 126,
        text: "Ubuntu, with this training site and the Cluster shell running on it. A Brev secure link brings your browser in; socat passes it on to the cluster. The Cluster shell's kubectl talks to the cluster as admin." },
      { title: "Kubernetes: the control plane", where: "k3s", nodes: ["kube-apiserver", "datastore", "kube-scheduler", "controller-manager"], x: 225, y: 417,
        text: "k3s is a full Kubernetes on a single machine. Its control plane decides what runs where: the API server everyone talks to, the datastore that holds the cluster's state, the scheduler that places pods, and the controller-manager that keeps things as declared." },
      { title: "Kubernetes: the worker", where: "k3s", nodes: ["kubelet · containerd"], x: 892, y: 885,
        text: "The kubelet takes its orders from the API server and starts each pod; containerd runs the containers. Here one node is both control plane and worker; larger clusters give the control plane its own nodes." },
      { title: "Envoy Gateway", where: "envoy-gateway-system", nodes: ["Envoy Gateway"], x: 246, y: 567,
        text: "The front door for web traffic: this site at /, Keycloak at /auth, Grafana at /grafana." },
      { title: "LiteLLM", where: "litellm", nodes: ["LiteLLM", "Upstream model API"], x: 1365, y: 808,
        text: "The model gateway. It holds your inference endpoint and its key, and offers one OpenAI-compatible API inside the cluster, with your model under the alias default. Every agent in this course talks to the model through it; only LiteLLM talks to the upstream API." },
      { title: "Keycloak", where: "keycloak", nodes: ["Keycloak"], x: 631, y: 576,
        text: "Sign-in for people, used from Module 1 on." },
      { title: "Monitoring", where: "monitoring", nodes: ["Prometheus", "Loki", "Alloy", "Tempo", "Grafana"], x: 1175, y: 575,
        text: "Prometheus for metrics, Alloy and Loki for logs, Tempo for traces, and Grafana to look at all of it." },
      { title: "Guardrails and plumbing", where: "cert-manager · kyverno · kube-system", nodes: ["cert-manager", "Kyverno", "CoreDNS · metrics-server"], x: 631, y: 1060,
        text: "cert-manager issues TLS certificates, Kyverno checks pods as they are created, and kube-system holds cluster DNS and the metrics kubectl top uses." },
      { title: "A demo app", where: "demo", nodes: ["shop-app", "payments", "loadgen"], x: 892, y: 720,
        text: "A small shop: shop-app calls payments, and loadgen keeps traffic flowing. The capstone breaks it on purpose." },
      { title: "Your agent", where: "agents (red)", nodes: ["pi-agent pod", "Secret litellm-key", "What it can do", "Any host on the internet"], x: 238, y: 763,
        text: "Not there yet: you deploy it in the next lab, the way agents are usually deployed, with an API key from a Secret. The red arrows show everything it will be able to reach." },
    ],
    outro: {
      title: "The whole stack, together",
      text: "One VM, one Kubernetes cluster, and on it everything an agent needs: a way in, a model behind LiteLLM, sign-in, monitoring, and something to work on. Now look at it for real with kubectl, then deploy the agent into it.",
    },
  },
};
