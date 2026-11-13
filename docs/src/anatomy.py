import sys; sys.path.insert(0, __import__("os").path.dirname(__file__))
from lib import *

S = Svg(1600, 930, "What a sandbox is",
        "Anatomy of an OpenShell sandbox: the gateway holds policies and credentials; a sandbox is a workload pod (agent as user sandbox, "
        "Landlock, seccomp, no direct network, placeholder secrets) plus a supervisor pod (deny-by-default L4/L7 policy, credential injection, "
        "FQDN-only DNS, OCSF audit, live policy updates). LiteLLM is allowed, api.github.com is allowed for GET after a policy update, "
        "the rest of the internet is denied. Kubernetes adds admission labels and a Kyverno guardrail.")
S.text(24, 38, "What a sandbox is", 26, True)
S.text(24, 64, "Security layers around one agent: an OpenShell sandbox is a workload pod plus a supervisor pod", 15, False, SUB)


def layer(x, y, w, h, title, lines, icon, color=GREY, kind="light", gap=18):
    S.box(x, y, w, h, title, lines, icon=icon, kind=kind, tsize=14.5, lsize=13.5, gap=gap)


# ---- left: control plane
S.box(24, 140, 276, 92, "You · Console · CLI", [("openshell sandbox create", "m"), ("openshell policy update", "m")],
      icon="i-people", kind="grey")
S.arrow("M162 232 V286", GREEN_D)
S.rect(24, 288, 276, 300, fill="#fff", stroke=GREEN, sw=1.8, rx=6)
S.icon("i-server", 34, 300, 22, GREEN_D)
S.text(64, 317, "OpenShell gateway", 15.5, True)
for i, (t, sub, ic) in enumerate([("policy store", "revisions v1, v2 …", "i-doc"),
                                  ("provider store", "real credentials", "i-key"),
                                  ("workspaces", None, "i-bundle")]):
    yy = 338 + i * 80
    layer(38, yy, 248, 66, t, [sub] if sub else [], ic)

# ---- middle: namespace with two pods
S.ns(330, 96, 850, 668, "lab", green=True, sub="· workspace lab · one sandbox")

# workload pod
S.rect(348, 150, 400, 596, fill="#fff", stroke=GREY, sw=1.3, rx=8)
S.icon("i-bot", 360, 160, 22, GREY)
S.text(390, 177, "workload pod", 15.5, True)
S.text(500, 177, "· the agent", 13.5, False, SUB)
wl = [("Agent process", ["e.g. pi · runs as user sandbox"], "i-user"),
      ("Landlock filesystem policy", [("read-only:  /usr /etc …", "m"), ("read-write: /sandbox /tmp", "m")], "i-lock"),
      ("seccomp", ["system-call filter on the agent"], "i-shield"),
      ("No direct network", ["NetworkPolicy: only the supervisor", "may connect to this pod"], "i-ban"),
      ("Placeholders, not secrets", [("LITELLM_API_KEY=", "m"), ("openshell:resolve:env:…", "m")], "i-key")]
y = 196
for t, lines, ic in wl:
    h = 58 + 18 * len(lines)
    layer(364, y, 368, h, t, lines, ic)
    y += h + 26

# supervisor pod
S.rect(828, 150, 334, 596, fill="#fff", stroke=GREEN, sw=1.8, rx=8)
S.icon("i-shield", 840, 160, 22, GREEN_D)
S.text(870, 177, "supervisor pod", 15.5, True)
S.text(990, 177, "· the guard", 13.5, False, SUB)
sv = [("Network policy engine", ["deny by default"], "i-shield"),
      ("L4 rules", [("host:port + binary", "m")], "i-svc"),
      ("L7 rules (rest)", [("method + path", "m")], "i-route"),
      ("Credential injection", ["placeholder → real key"], "i-key"),
      ("DNS", ["FQDN only"], "i-globe"),
      ("OCSF audit", ["audit events → Loki"], "i-doc"),
      ("Live policy updates", ["revision v1 → v2, no restart"], "i-sync")]
y = 196
for t, lines, ic in sv:
    layer(844, y, 302, 66, t, lines, ic, gap=18)
    y += 66 + 9

# workload -> supervisor
S.arrow("M748 470 H826", GREEN_D)
S.label(787, 458, "all", GREEN_D, size=12.5)
S.label(787, 490, "egress", GREEN_D, size=12.5)

# gateway -> supervisor
S.arrow("M300 360 H314 V132 H995 V148", GREEN_D)
S.label(600, 136, "policy + credentials, pushed live", GREEN_D)

# ---- right: destinations
S.rect(1226, 150, 350, 160, fill="#fff", stroke=GREEN, sw=1.8, rx=6)
S.icon("i-chip", 1236, 162, 22, GREEN_D)
S.text(1266, 179, "LiteLLM", 15.5, True)
S.label(1555, 178, "ALLOWED", GREEN_D, anchor="end", size=12, bold=True, bg=GREEN_T)
S.text(1240, 204, "via provider litellm (L7 rules):", 13.5, False, SUB)
S.text(1240, 228, "GET  /v1/models", 13, False, INK, mono=True)
S.text(1240, 250, "POST /v1/chat/completions", 13, False, INK, mono=True)
S.text(1240, 272, "…", 13, False, INK, mono=True)
S.text(1240, 296, "key injected by the supervisor", 13.5, False, SUB)

S.rect(1226, 346, 350, 130, fill="#fff", stroke=GREEN, sw=1.8, rx=6, dash="7 4")
S.icon("i-git", 1236, 358, 22, GREEN_D)
S.text(1266, 375, "api.github.com", 15.5, True)
S.label(1555, 374, "ALLOWED (v2)", GREEN_D, anchor="end", size=12, bold=True, bg=GREEN_T)
S.text(1240, 400, "GET only", 13.5, False, INK)
S.text(1240, 424, "after", 13.5, False, SUB)
S.text(1276, 424, "openshell policy update", 13, False, INK, mono=True)
S.text(1240, 448, "denied in v1, allowed in v2, no restart", 13.5, False, SUB)

S.rect(1226, 512, 350, 104, fill=RED_T, stroke=RED, sw=1.6, rx=6)
S.icon("i-globe", 1236, 524, 22, RED)
S.text(1266, 541, "the internet", 15.5, True)
S.label(1555, 540, "DENIED", RED, anchor="end", size=12, bold=True, bg="#fbdcdc")
S.text(1240, 566, "everything not in the policy", 13.5, False, INK)
S.text(1240, 590, "blocked + logged as OCSF event", 13.5, False, SUB)

S.arrow("M1162 230 H1224", GREEN_D)
S.label(1193, 222, "allow", GREEN_D, size=12.5)
S.arrow("M1162 410 H1224", GREEN_D, dash="6 4")
S.label(1193, 402, "v2", GREEN_D, size=12.5)
S.arrow("M1162 564 H1224", RED, dash="6 4")
S.label(1193, 556, "deny", RED, size=12.5)

# ---- bottom: Kubernetes layer
S.rect(24, 790, 1552, 116, fill=BG, stroke="#9aa3ad", sw=1.3, rx=8)
S.icon("i-wheel", 36, 800, 22, GREY)
S.text(66, 817, "Kubernetes layer", 15.5, True)
S.text(212, 817, "· cluster-side guardrails around every sandbox", 13.5, False, SUB)
S.box(40, 832, 640, 62, "Resource admission labels", [("openshell.ai/sandbox-attachable on cluster resources", "m")],
      icon="i-doc", kind="grey", tsize=14.5)
S.box(700, 832, 520, 62, "Kyverno guardrail on sandbox pods", ["no host network · no host PID · no host IPC"],
      icon="i-shield", kind="grey", tsize=14.5)
# legend
S.arrow("M1244 850 H1280", GREEN_D)
S.text(1290, 855, "allowed by policy", 13.5, False, SUB)
S.arrow("M1244 878 H1280", RED, dash="6 4")
S.text(1290, 883, "denied (L4 or L7)", 13.5, False, SUB)

S.save(sys.argv[1])
