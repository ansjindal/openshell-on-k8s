import sys; sys.path.insert(0, __import__("os").path.dirname(__file__))
from lib import *

# The lab cluster as Module 0 meets it: everything except OpenShell, plus the
# pi agent deployed as an ordinary workload (manifests/agents/pi-agent.yaml).
S = Svg(1600, 1090, "Your cluster",
        "The lab cluster: a single Brev VM running k3s with Envoy Gateway, Keycloak, a monitoring stack, "
        "LiteLLM in front of the upstream model API, cert-manager, Kyverno, a demo shop app, and the pi agent deployed as an "
        "ordinary Deployment that holds the real LiteLLM key and can reach the Kubernetes API and the internet.")
S.text(24, 38, "Your cluster", 26, True)
S.text(24, 64, "One Brev VM running Kubernetes, with the model behind LiteLLM, and an agent deployed the usual way", 15, False, SUB)

# ---- outside the VM
S.box(24, 100, 160, 52, "Browser", icon="i-browser")
S.box(230, 96, 330, 60, "Brev Secure Link", [("https://openshell-<id>.<domain>", "m")], icon="i-lock", tsize=14.5, gap=20)
S.arrow("M184 126 H228")

# ---- VM
S.rect(20, 180, 1560, 818, fill=BG, stroke="#9aa3ad", sw=1.5, rx=10)
S.icon("i-cloud", 34, 188, 22, GREY)
S.text(62, 205, "Brev VM · Ubuntu 22.04", 16, True)
S.text(268, 205, "(host processes)", 13.5, False, SUB)
S.arrow("M380 156 V226")
S.label(388, 197, "host :3001", anchor="start")

S.box(40, 228, 190, 58, "kubectl", ["cluster admin"], icon="i-term")
S.box(250, 228, 430, 58, "socat", ["host port 3001 → Envoy Gateway"], icon="i-route")
S.box(700, 228, 390, 58, "Training site", ["Next.js + live terminal · systemd · :3000"], icon="i-portal")

# ---- k3s
S.rect(36, 308, 1528, 674, fill=AREA, stroke=LINE, sw=1.2, rx=8)
S.icon("i-wheel", 46, 314, 22, GREY)
S.text(74, 331, "k3s v1.37 · single node", 15, True)

# Row 1
S.box(72, 372, 348, 110, "Envoy Gateway", ["Gateway API · Gateway fleet-gw",
      ("openshell-<id>: /  /auth  /grafana", "m")], icon="i-route")
S.arrow("M380 286 V370")
S.ns(472, 372, 318, 110, "keycloak", color="keycloak")
S.box(486, 400, 290, 72, "Keycloak", ["realm openshell", "sign-in for people"], icon="i-people", gap=18)
S.ns(810, 372, 730, 110, "monitoring", color="monitoring")
for x, w, t, sub, ic in [(826, 140, "Tempo", "traces", "i-trace"), (978, 120, "Loki", "logs", "i-doc"),
                         (1110, 130, "Grafana", "dashboards", "i-chart"), (1252, 140, "Prometheus", "metrics", "i-gauge"),
                         (1404, 122, "Alloy", "collector", "i-sync")]:
    S.box(x, 400, w, 70, t, [sub], icon=ic, tsize=14.5)
S.arrow("M420 396 H440 V342 H895 V288")
S.label(560, 346, "/ → host :3000")
S.arrow("M420 420 H452 V356 H1175 V398")
S.label(800, 360, "/grafana")
S.arrow("M420 455 H484")
S.label(452, 449, "/auth", size=12.5)

# Row 2: the agent, deployed the usual way
S.ns(72, 510, 560, 320, "agents", color="agents", sub="· the agent from 0.4")
S.box(88, 548, 300, 150, "pi-agent pod", ["node:22 + the pi harness", "bash, curl, npm: any tool",
      ("LITELLM_API_KEY = the real key", "r"), ("ServiceAccount token mounted", "k")], icon="i-bot", kind="red", gap=20)
S.box(88, 730, 300, 70, "Secret litellm-key", ["LiteLLM's master key, as an env var"], icon="i-key")
S.arrow("M238 728 V700")
S.box(412, 548, 204, 116, "What it can do", ["call the model", "reach any host", "talk to the cluster API",
      "leave no audit trail"], icon="i-shield", kind="light", gap=18)

S.ns(652, 510, 480, 150, "demo", color="demo", sub="· a small shop app")
S.box(668, 548, 140, 64, "shop-app", [":8080"], icon="i-svc", tsize=14.5)
S.box(824, 548, 140, 64, "payments", [":8080"], icon="i-svc", tsize=14.5)
S.box(980, 548, 136, 64, "loadgen", ["traffic"], icon="i-sync", tsize=14.5)
S.arrow("M808 580 H822")

S.box(652, 690, 480, 110, "Kubernetes API (k3s)", ["the control plane every kubectl talks to",
      ("a pod's ServiceAccount token works here too", "k")], icon="i-wheel", gap=20)

S.ns(1190, 510, 350, 320, "litellm", color="litellm")
S.box(1206, 600, 318, 136, "LiteLLM", ["OpenAI-compatible API", ("litellm.litellm.svc:4000", "m"),
      "model: your MODEL_NAME, alias default", "upstream key from a Secret"], icon="i-chip", gap=20)

# the agent's reach (red: nothing checks it)
S.arrow("M350 546 V496 H1290 V598", RED)
S.label(800, 500, "LLM calls · the real key", RED, bold=True)
S.arrow("M388 674 H560 V745 H650", RED)
S.label(486, 674, "its token", RED, size=12.5)
S.arrow("M388 692 H446 V1043 H858", RED)
S.label(454, 1000, "any host", RED, anchor="start", size=12.5)
S.box(860, 1014, 320, 58, "Any host on the internet", ["no rule, no log"], icon="i-globe", kind="red")

# Row 3
S.ns(72, 860, 348, 104, "cert-manager", color="certs")
S.box(88, 890, 316, 60, "cert-manager", ["TLS certificates · lab CA"], icon="i-cert")
S.ns(472, 860, 318, 104, "kyverno", color="kyverno")
S.box(486, 890, 290, 60, "Kyverno", ["admission rules on pods"], icon="i-shield")
S.ns(810, 860, 322, 104, "kube-system")
S.box(826, 890, 290, 60, "CoreDNS · metrics-server", ["cluster DNS and metrics"], icon="i-gear")

# LiteLLM -> upstream
S.arrow("M1365 736 V1012", GREY)
S.label(1373, 880, "HTTPS", anchor="start")
S.box(1210, 1014, 320, 58, "Upstream model API", ["your MODEL_BASE_URL"], icon="i-globe")

# legend
lx, ly = 24, 1024
S.rect(lx, ly - 10, 30, 18, fill="#fff", stroke=GREY, sw=1.3, rx=4)
S.text(lx + 38, ly + 4, "platform component", 13.5, False, SUB)
S.rect(lx + 200, ly - 10, 30, 18, fill=RED_T, stroke=RED, sw=1.6, rx=4)
S.text(lx + 238, ly + 4, "the deployed agent", 13.5, False, SUB)
S.arrow(f"M{lx+400} {ly} H{lx+440}", RED)
S.text(lx + 450, ly + 4, "agent traffic: nothing checks it", 13.5, False, SUB)
S.arrow(f"M{lx+660} {ly} H{lx+700}", GREY)
S.text(lx + 710, ly + 4, "HTTP routing", 13.5, False, SUB)
ly2 = 1064
S.text(lx, ly2 + 4, "namespaces:", 13.5, True, SUB)
nx = lx + 100
for key, name in [("agents", "agents"), ("demo", "demo"), ("keycloak", "keycloak"), ("monitoring", "monitoring"),
                  ("litellm", "litellm"), ("certs", "cert-manager"), ("kyverno", "kyverno")]:
    stroke, tint = NS_COLORS[key][:2]
    S.rect(nx, ly2 - 9, 22, 16, fill=tint, stroke=stroke, sw=1.4, rx=4)
    nx += 30 + S.text(nx + 30, ly2 + 4, name, 13, False, SUB) + 22

S.save(sys.argv[1])
