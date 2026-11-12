import sys; sys.path.insert(0, __import__("os").path.dirname(__file__))
from lib import *

# The lab cluster as Module 0 meets it, split into its two halves: the control
# plane (the k3s server) and the worker side (kubelet, containerd and the
# workloads), plus the pi agent deployed as an ordinary workload in 0.4.
S = Svg(1600, 1320, "Your cluster",
        "The lab cluster: one Brev VM running k3s. The control plane (kube-apiserver, datastore, scheduler, controller-manager) "
        "and the worker side (kubelet and containerd) run on the same node. Workloads: Envoy Gateway, Keycloak, a monitoring stack, "
        "LiteLLM in front of the upstream model API, cert-manager, Kyverno, a demo shop app, and the pi agent deployed as an "
        "ordinary Deployment that holds the real LiteLLM key and can reach the Kubernetes API and the internet.")
S.text(24, 38, "Your cluster", 26, True)
S.text(24, 64, "One Brev VM running Kubernetes: a control plane and a worker on the same node, with the model behind LiteLLM", 15, False, SUB)

# ---- outside the VM
S.box(24, 100, 160, 52, "Browser", icon="i-browser")
S.box(230, 96, 330, 60, "Brev Secure Link", [("https://openshell-<id>.<domain>", "m")], icon="i-lock", tsize=14.5, gap=20)
S.arrow("M184 126 H228")

# ---- VM
S.rect(20, 180, 1560, 966, fill=BG, stroke="#9aa3ad", sw=1.5, rx=10)
S.icon("i-cloud", 34, 188, 22, GREY)
S.text(62, 205, "Brev VM · Ubuntu 22.04", 16, True)
S.text(268, 205, "(host processes)", 13.5, False, SUB)
S.arrow("M380 156 V226")
S.label(388, 197, "host :3001", anchor="start")
S.box(40, 228, 190, 58, "kubectl", ["cluster admin"], icon="i-term")
S.box(250, 228, 430, 58, "socat", ["host port 3001 → Envoy Gateway"], icon="i-route")
S.box(700, 228, 390, 58, "Training site", ["Next.js + live terminal · systemd · :3000"], icon="i-portal")

# ---- k3s: one node, two halves
S.rect(36, 308, 1528, 822, fill=AREA, stroke=LINE, sw=1.2, rx=8)
S.icon("i-wheel", 46, 314, 22, GREY)
S.text(74, 331, "k3s v1.37 · one node, two halves", 15, True)

# Control plane
S.rect(52, 346, 1496, 120, fill="#f6f7f9", stroke="#9aa3ad", sw=1.4, rx=8)
S.text(64, 366, "Control plane", 14.5, True)
S.text(170, 366, "· the k3s server process", 13.5, False, SUB)
S.box(80, 382, 290, 70, "kube-apiserver", ["the cluster's API: kubectl, and", "any pod with a token"], icon="i-svc", gap=18, lsize=13)
S.box(400, 382, 230, 70, "datastore", ["SQLite, via kine"], icon="i-db")
S.box(650, 382, 240, 70, "kube-scheduler", ["picks a node for each pod"], icon="i-gear")
S.box(910, 382, 270, 70, "controller-manager", ["keeps the cluster as declared"], icon="i-sync")
for i, line in enumerate(["Here both halves share one node.", "Larger clusters give the control",
                          "plane its own nodes."]):
    S.text(1210, 398 + i * 18, line, 13, False, SUB)

# Worker
S.rect(52, 482, 1496, 638, fill="#f6f7f9", stroke="#9aa3ad", sw=1.4, rx=8)
S.text(64, 502, "Worker", 14.5, True)
S.text(130, 502, "· the same node runs the workloads", 13.5, False, SUB)

S.arrow("M380 286 V510")  # socat -> envoy, through the gap in the control plane row

# Row 1
S.box(72, 512, 348, 110, "Envoy Gateway", ["Gateway API · Gateway fleet-gw",
      ("openshell-<id>: /  /auth  /grafana", "m")], icon="i-route")
S.ns(472, 512, 318, 110, "keycloak", color="keycloak")
S.box(486, 540, 290, 72, "Keycloak", ["realm openshell", "sign-in for people"], icon="i-people", gap=18)
S.ns(810, 512, 730, 110, "monitoring", color="monitoring")
for x, w, t, sub, ic in [(826, 140, "Tempo", "traces", "i-trace"), (978, 120, "Loki", "logs", "i-doc"),
                         (1110, 130, "Grafana", "dashboards", "i-chart"), (1252, 140, "Prometheus", "metrics", "i-gauge"),
                         (1404, 122, "Alloy", "collector", "i-sync")]:
    S.box(x, 540, w, 70, t, [sub], icon=ic, tsize=14.5)
S.arrow("M420 595 H484")
S.label(452, 589, "/auth", size=12.5)

# Row 2: the agent, deployed the usual way
S.ns(72, 650, 560, 310, "agents", color="agents", sub="· the agent from 0.4")
S.box(88, 688, 300, 150, "pi-agent pod", ["node:22 + the pi harness", "bash, curl, npm: any tool",
      ("LITELLM_API_KEY = the real key", "r"), ("ServiceAccount token mounted", "k")], icon="i-bot", kind="red", gap=20)
S.box(412, 688, 204, 116, "What it can do", ["call the model", "reach any host", "talk to the cluster API",
      "leave no audit trail"], icon="i-shield", kind="light", gap=18)
S.box(88, 870, 300, 70, "Secret litellm-key", ["LiteLLM's master key, as an env var"], icon="i-key")
S.arrow("M238 868 V840")

S.ns(652, 650, 480, 150, "demo", color="demo", sub="· a small shop app")
S.box(668, 688, 140, 64, "shop-app", [":8080"], icon="i-svc", tsize=14.5)
S.box(824, 688, 140, 64, "payments", [":8080"], icon="i-svc", tsize=14.5)
S.box(980, 688, 136, 64, "loadgen", ["traffic"], icon="i-sync", tsize=14.5)
S.arrow("M808 720 H822")

S.box(652, 830, 480, 110, "kubelet · containerd", ["the worker side of the node: takes its orders from",
      "the API server, starts each pod, runs its containers"], icon="i-cube", gap=20, lsize=13.5)

S.ns(1190, 650, 350, 310, "litellm", color="litellm")
S.box(1206, 740, 318, 136, "LiteLLM", ["OpenAI-compatible API", ("litellm.litellm.svc:4000", "m"),
      "model: your MODEL_NAME, alias default", "upstream key from a Secret"], icon="i-chip", gap=20)

# Row 3
S.ns(72, 1000, 348, 104, "cert-manager", color="certs")
S.box(88, 1030, 316, 60, "cert-manager", ["TLS certificates · lab CA"], icon="i-cert")
S.ns(472, 1000, 318, 104, "kyverno", color="kyverno")
S.box(486, 1030, 290, 60, "Kyverno", ["admission rules on pods"], icon="i-shield")
S.ns(810, 1000, 322, 104, "kube-system")
S.box(826, 1030, 290, 60, "CoreDNS · metrics-server", ["cluster DNS and metrics"], icon="i-gear")

# the agent's reach (red: nothing checks it)
S.arrow("M350 686 V636 H1290 V738", RED)
S.label(800, 640, "LLM calls · the real key", RED, bold=True)
S.arrow("M88 720 H62 V420 H78", RED)                     # its token -> the API server
S.label(68, 641, "its token", RED, anchor="start", size=12.5)
S.arrow("M88 810 H44 V1164", RED)                        # anything, anywhere
S.label(52, 980, "any host", RED, anchor="start", size=12.5)
S.box(30, 1166, 330, 58, "Any host on the internet", ["no rule, no log"], icon="i-globe", kind="red")

# LiteLLM -> upstream
S.arrow("M1365 876 V1164", GREY)
S.label(1373, 1150, "HTTPS", anchor="start")
S.box(1206, 1166, 320, 58, "Upstream model API", ["your MODEL_BASE_URL"], icon="i-globe")

# legend
lx, ly = 24, 1262
S.rect(lx, ly - 10, 30, 18, fill="#fff", stroke=GREY, sw=1.3, rx=4)
S.text(lx + 38, ly + 4, "platform component", 13.5, False, SUB)
S.rect(lx + 200, ly - 10, 30, 18, fill=RED_T, stroke=RED, sw=1.6, rx=4)
S.text(lx + 238, ly + 4, "the deployed agent", 13.5, False, SUB)
S.arrow(f"M{lx+400} {ly} H{lx+440}", RED)
S.text(lx + 450, ly + 4, "agent traffic: nothing checks it", 13.5, False, SUB)
S.arrow(f"M{lx+680} {ly} H{lx+720}", GREY)
S.text(lx + 730, ly + 4, "HTTP routing", 13.5, False, SUB)
ly2 = 1298
S.text(lx, ly2 + 4, "namespaces:", 13.5, True, SUB)
nx = lx + 100
for key, name in [("agents", "agents"), ("demo", "demo"), ("keycloak", "keycloak"), ("monitoring", "monitoring"),
                  ("litellm", "litellm"), ("certs", "cert-manager"), ("kyverno", "kyverno")]:
    stroke, tint = NS_COLORS[key][:2]
    S.rect(nx, ly2 - 9, 22, 16, fill=tint, stroke=stroke, sw=1.4, rx=4)
    nx += 30 + S.text(nx + 30, ly2 + 4, name, 13, False, SUB) + 22

S.save(sys.argv[1])
