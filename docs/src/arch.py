import sys; sys.path.insert(0, __import__("os").path.dirname(__file__))
from lib import *

S = Svg(1600, 1090, "One VM, the whole platform",
        "OpenShell on Kubernetes lab architecture: a single Brev VM running k3s with Envoy Gateway, the OpenShell gateway and console, "
        "one namespace per workspace, of the same name, prepared with the openshell-workspace chart (lab with agent-0 and agent-1, team-a with lab-a), each sandbox a workload pod and a supervisor pod, Keycloak, LiteLLM, cert-manager, Kyverno, agent-sandbox controller and a monitoring stack.")
S.text(24, 38, "One VM, the whole platform", 26, True)
S.text(24, 64, "OpenShell on Kubernetes training lab: everything below runs on a single Brev VM", 15, False, SUB)

# ---- outside the VM
S.box(24, 100, 160, 52, "Browser", icon="i-browser")
S.box(230, 96, 330, 60, "Brev Secure Link", [("https://openshell-<id>.<domain>", "m")], icon="i-lock", tsize=14.5, gap=20)
S.box(600, 96, 330, 60, "Brev Secure Link", [("https://console-<id>.<domain>", "m")], icon="i-lock", tsize=14.5, gap=20)
S.arrow("M184 126 H228", flow="1")
S.arrow("M104 100 V84 H765 V94", flow="1")

# ---- VM
S.rect(20, 180, 1560, 818, fill=BG, stroke="#9aa3ad", sw=1.5, rx=10)
S.icon("i-cloud", 34, 188, 22, GREY)
S.text(62, 205, "Brev VM · Ubuntu 22.04", 16, True)
S.text(268, 205, "(host processes)", 13.5, False, SUB)

S.arrow("M380 156 V226", flow="1")
S.label(388, 197, "host :3001", anchor="start", flow="1")
S.arrow("M640 156 V226", flow="1")
S.label(648, 197, "host :3002", anchor="start", flow="1")

S.box(40, 228, 190, 58, "openshell CLI", ["operator client cert"], icon="i-term")
S.box(250, 228, 430, 58, "socat", ["host ports 3001 / 3002 → Envoy Gateway"], icon="i-route")
S.box(700, 228, 390, 58, "Training site", ["Next.js + live terminal · systemd · :3000"], icon="i-portal")

# ---- k3s
S.rect(36, 308, 1528, 674, fill=AREA, stroke=LINE, sw=1.2, rx=8)
S.icon("i-wheel", 46, 314, 22, GREY)
S.text(74, 331, "k3s v1.37 · single node", 15, True)

# Row 1 ------------------------------------------------------------
S.box(72, 372, 348, 110, "Envoy Gateway", ["Gateway API · Gateway fleet-gw",
      ("openshell-<id>: /  /auth  /grafana", "m"), ("console-<id>:   Console", "m")], icon="i-route")
S.arrow("M380 286 V370", flow="1")  # socat -> envoy

S.ns(472, 372, 318, 110, "keycloak", color="keycloak")
S.box(486, 400, 290, 72, "Keycloak", ["realm openshell", "users: demo (admin), learner"], icon="i-people", gap=18)

S.ns(810, 372, 730, 110, "monitoring", color="monitoring")
mon = [(826, 140, "Tempo", "traces", "i-trace"), (978, 120, "Loki", "logs", "i-doc"),
       (1110, 130, "Grafana", "dashboards", "i-chart"), (1252, 140, "Prometheus", "metrics", "i-gauge"),
       (1404, 122, "Alloy", "collector", "i-sync")]
for x, w, t, sub, ic in mon:
    S.box(x, 400, w, 70, t, [sub], icon=ic, tsize=14.5)

# envoy routes
S.arrow("M420 396 H440 V342 H895 V288", flow="1")
S.label(560, 346, "/ → host :3000", flow="1")
S.arrow("M420 420 H452 V356 H1175 V398", flow="1")
S.label(800, 360, "/grafana", flow="1")
S.arrow("M420 455 H484", flow="1")
S.label(452, 449, "/auth", size=12.5, flow="1")

# Row 2 ------------------------------------------------------------
S.ns(72, 510, 348, 320, "openshell", green=True)
S.box(88, 548, 316, 64, "OpenShell Console", ["oauth2-proxy + Go BFF"], icon="i-portal", kind="green")
S.arrow("M300 482 V546", flow="1")
S.label(308, 500, "console-<id>", anchor="start", flow="1")
S.box(88, 660, 316, 140, "OpenShell gateway 0.1.7", ["StatefulSet · SQLite", "OIDC + mTLS",
      "NodePort 30808 (VM CLI)"], icon="i-server", kind="green")
S.arrow("M340 612 V658", GREEN_D, flow="2")
S.label(332, 641, "user's Keycloak token", GREEN_D, anchor="end", flow="2")
# CLI -> gateway
S.arrow("M54 286 V735 H86", GREEN_D, flow="1 2")
S.label(62, 300, "mTLS · OU=operator = platform admin → NodePort 30808", GREEN_D, anchor="start", size=13, mono=False, flow="1 2")

# ---- workspaces: operator mode, each workspace a namespace of the same name
S.ns(472, 510, 660, 236, "lab", green=True, sub="· workspace lab · openshell-workspace chart")
# agent-1 and more, compact
def pair(x, y, small=False):
    """A sandbox's two pods, side by side: workload (grey) and supervisor (green)."""
    w1, w2, h = (76, 76, 40)
    S.raw('<g class="dg-node" data-node="workload pod">')
    S.rect(x, y, w1, h, fill="#fff", stroke=GREY, sw=1.2, rx=6)
    S.text(x + 7, y + 25, "workload", 13, False, INK, check=False)
    S.raw('</g>')
    S.raw('<g class="dg-node" data-node="supervisor pod">')
    S.rect(x + w1 + 6, y, w2, h, fill="#fff", stroke=GREEN, sw=1.5, rx=6)
    S.text(x + w1 + 11, y + 25, "supervisor", 13, False, INK, check=False)
    S.raw('</g>')

S.raw('<g class="dg-node" data-node="agent-1">')
S.rect(496, 574, 172, 82, fill=GREEN_T, stroke=GREEN_L, sw=1, rx=8)
S.rect(488, 566, 172, 82, fill="#fff", stroke=GREEN, sw=1.4, rx=8)
S.icon("i-cube", 498, 572, 18, GREEN_D)
S.text(522, 587, "agent-1", 14, True)
S.text(584, 587, "· Ready", 13, True, GREEN_D)
S.raw('</g>')
pair(496, 598)
S.raw('<g class="dg-node" data-node="more sandboxes">')
S.rect(488, 664, 172, 70, fill="#fff", stroke=GREEN_L, sw=1.2, rx=8, dash="5 4")
S.text(500, 690, "+ more sandboxes", 13.5, True, GREEN_D)
S.text(500, 712, "each its own pair", 13, False, SUB)
S.raw('</g>')
# agent-0 in detail
S.raw('<g class="dg-node" data-node="agent-0">')
S.rect(684, 574, 440, 168, fill=GREEN_T, stroke=GREEN_L, sw=1, rx=8)
S.rect(676, 566, 440, 168, fill="#fff", stroke=GREEN, sw=1.4, rx=8)
S.icon("i-cube", 686, 572, 20, GREEN_D)
S.text(712, 588, "sandbox agent-0", 14.5, True)
S.text(848, 588, "· Ready", 13.5, True, GREEN_D)
S.raw('</g>')
S.box(688, 598, 190, 128, "workload pod", ["OpenClaw agent", "Landlock + seccomp", "user sandbox",
      ("NetPol: supervisor only", "k")], icon="i-bot", kind="grey", tsize=14.5, lsize=13, gap=18)
S.box(924, 598, 180, 128, "supervisor pod", ["policy L4 / L7", "credential injection", "OCSF audit",
      "trace relay"], icon="i-shield", kind="green", tsize=14.5, lsize=13, gap=18)
S.arrow("M880 676 H922", GREEN_D, both=True, flow="3")
S.label(901, 664, "port", GREEN_D, size=12.5, flow="3")

S.ns(472, 758, 660, 72, "team-a", green=True, sub="· workspace team-a · openshell-workspace chart")
S.raw('<g class="dg-node" data-node="lab-a">')
S.rect(872, 764, 248, 60, fill="#fff", stroke=GREEN, sw=1.4, rx=8)
S.icon("i-cube", 880, 770, 18, GREEN_D)
S.text(902, 786, "lab-a", 14, True)
S.text(882, 810, "Ready", 13, True, GREEN_D)
S.raw('</g>')
pair(958, 774)

# gateway -> workspaces (creates namespaces, sandboxes, policy)
S.arrow("M404 710 H458 V552 H1010 V596", GREEN_D, flow="2")
S.label(760, 556, "creates sandboxes · policy", GREEN_D, flow="2")
S.arrow("M458 710 V794 H470", GREEN_D, flow="2")
# gateway -> tempo
S.arrow("M404 690 H446 V496 H836 V472", MID, dash="6 4", flow="4")
S.label(640, 500, "traces", MID, flow="4")
# supervisor -> tempo / loki
S.arrow("M944 596 V472", MID, dash="6 4", flow="4")
S.label(938, 500, "agent traces", MID, anchor="end", size=12.5, flow="4")
S.arrow("M1060 596 V472", MID, dash="6 4", flow="4")
S.label(1066, 500, "OCSF audit", MID, anchor="start", size=12.5, flow="4")

S.ns(1190, 510, 350, 320, "litellm", color="litellm")
S.box(1210, 640, 310, 96, "LiteLLM", ["OpenAI-compatible API", ("litellm.litellm.svc:4000", "m")], icon="i-chip")
S.arrow("M1104 676 H1208", GREEN_D, flow="3")
S.label(1156, 668, "LLM calls", GREEN_D, size=12.5, flow="3")
S.label(1156, 694, "key injected", GREEN_D, size=12.5, flow="3")

# Row 3 ------------------------------------------------------------
S.ns(72, 860, 348, 104, "cert-manager", color="certs")
S.box(88, 890, 316, 60, "cert-manager", ["gateway TLS · operator cert · lab CA"], icon="i-cert")
S.arrow("M360 888 V802", MID, dash="3 3", flow="2")
S.label(352, 849, "issues certs", MID, anchor="end", size=12.5, flow="2")

S.ns(472, 860, 318, 104, "agent-sandbox-system", color="controller")
S.box(486, 890, 290, 60, "agent-sandbox controller", ["Sandbox CR → workload pod"], icon="i-gear")
S.arrow("M404 790 H440 V920 H484", GREEN_D, flow="2")
S.label(440, 849, "Sandbox CR", GREEN_D, size=12.5, flow="2")
S.arrow("M752 888 V832", GREY, flow="2")
S.label(744, 849, "workload pods", GREY, anchor="end", size=12.5, flow="2")

S.ns(810, 860, 322, 104, "kyverno", color="kyverno")
S.box(826, 890, 290, 60, "Kyverno", ["guardrails on sandbox pods"], icon="i-shield")
S.arrow("M990 888 V832", MID, dash="3 3", flow="2")
S.label(998, 849, "admission", MID, anchor="start", size=12.5, flow="2")

# LiteLLM -> upstream
S.arrow("M1365 736 V1012", GREY, flow="3")
S.label(1373, 880, "HTTPS", anchor="start", flow="3")
S.box(1210, 1014, 320, 58, "Upstream model API", ["e.g. build.nvidia.com"], icon="i-globe")

# legend
lx, ly = 24, 1024
S.rect(lx, ly - 10, 30, 18, fill="#fff", stroke=GREEN, sw=1.8, rx=4)
S.text(lx + 38, ly + 4, "OpenShell component", 13.5, False, SUB)
S.rect(lx + 200, ly - 10, 30, 18, fill="#fff", stroke=GREY, sw=1.3, rx=4)
S.text(lx + 238, ly + 4, "platform component", 13.5, False, SUB)
S.arrow(f"M{lx+400} {ly} H{lx+440}", GREEN_D)
S.text(lx + 450, ly + 4, "OpenShell API / agent traffic", 13.5, False, SUB)
S.arrow(f"M{lx+660} {ly} H{lx+700}", GREY)
S.text(lx + 710, ly + 4, "HTTP routing", 13.5, False, SUB)
S.arrow(f"M{lx+820} {ly} H{lx+860}", MID, dash="6 4")
S.text(lx + 870, ly + 4, "telemetry", 13.5, False, SUB)

# namespace colours
ly2 = 1064
S.text(lx, ly2 + 4, "namespaces:", 13.5, True, SUB)
nx = lx + 100
for key, name in [(None, "OpenShell (control plane, workspaces)"), ("keycloak", "keycloak"), ("monitoring", "monitoring"),
                  ("litellm", "litellm"), ("certs", "cert-manager"), ("controller", "agent-sandbox"), ("kyverno", "kyverno")]:
    stroke, tint = (GREEN_L, GREEN_T) if key is None else NS_COLORS[key][:2]
    S.rect(nx, ly2 - 9, 22, 16, fill=tint, stroke=stroke, sw=1.4, rx=4)
    nx += 30 + S.text(nx + 30, ly2 + 4, name, 13, False, SUB) + 22

S.save(sys.argv[1])
