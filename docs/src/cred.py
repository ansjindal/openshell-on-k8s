import sys; sys.path.insert(0, __import__("os").path.dirname(__file__))
from lib import *

H = 1220
S = Svg(1600, H, "The key the agent never sees",
        "Credential flow: the operator stores the real LiteLLM key in the OpenShell gateway as provider litellm; the sandbox policy gets "
        "_provider_litellm; the agent only holds a placeholder and calls POST /v1/chat/completions; the supervisor matches the policy, "
        "swaps the placeholder for the real key and forwards to LiteLLM and the upstream model. A call to POST /key/generate is denied "
        "at L7 with a 403 and logged as an OCSF event in Loki.")
S.text(24, 38, "The key the agent never sees", 26, True)
S.text(24, 64, "Credential injection with an OpenShell provider: the real key stays in the gateway and the supervisor", 15, False, SUB)

lanes = [("Agent process", 222, "i-bot", "grey"), ("Supervisor", 620, "i-shield", "green"),
         ("Gateway", 980, "i-server", "green"), ("LiteLLM", 1260, "i-chip", "grey"),
         ("Upstream model", 1478, "i-globe", "grey")]
for t, cx, ic, k in lanes:
    w = 200 if cx != 1478 else 190
    col = GREEN if k == "green" else "#9aa3ad"
    S.raw(f'<path d="M{cx} 150 V{H-110}" stroke="{col}" stroke-width="1.4" stroke-dasharray="4 5" fill="none"/>')
for t, cx, ic, k in lanes:
    w = 200 if cx != 1478 else 190
    S.box(cx - w / 2, 96, w, 54, t, icon=ic, kind=k)


def phase(y, text, color=SUB):
    S.raw(f'<path d="M24 {y} H1576" stroke="#d8dce1" stroke-width="1" fill="none"/>')
    S.label(30, y + 4, text, color, anchor="start", size=12.5, mono=False, bold=True)


# ---------------- setup
phase(172, "SETUP (once)")
S.box(40, 190, 520, 74, "Operator · openshell CLI", [("openshell provider create --name litellm", "mk"),
      ("  --type litellm --credential LITELLM_API_KEY", "mk")], icon="i-term", gap=18, lsize=13)
S.arrow("M562 227 H858", GREEN_D)
S.badge(586, 227, 1)
S.label(720, 220, "real key", GREEN_D, size=12.5)
S.box(860, 190, 260, 74, "Provider store", ["provider litellm", "holds the real key"], icon="i-key", kind="green", gap=18, lsize=13)

S.box(40, 288, 520, 56, "Create the sandbox", [("openshell sandbox create … --provider litellm", "mk")], icon="i-term", gap=18, lsize=13)
S.arrow("M562 316 H858", GREEN_D)
S.badge(586, 316, 2)
S.label(720, 309, "--provider litellm", GREEN_D, size=12.5)
S.box(860, 288, 260, 74, "Merge into policy", ["profile endpoint + rules", ("→ _provider_litellm", "mg")],
      icon="i-doc", kind="green", gap=18, lsize=13)
S.arrow("M900 362 V392 H624", GREEN_D)
S.label(760, 392, "policy incl. _provider_litellm", GREEN_D, size=12.5)

# ---------------- request
phase(426, "ALLOWED REQUEST")
S.box(52, 446, 340, 58, "Agent env holds a placeholder", [("LITELLM_API_KEY=openshell:resolve:env:…", "mk")],
      gap=18, lsize=13, tsize=14.5)
S.arrow("M224 552 H616", GREY)
S.badge(246, 552, 3)
S.label(420, 543, "POST /v1/chat/completions", INK, size=12.5)
S.label(420, 570, "Authorization: Bearer <placeholder>", SUB, size=12.5)

S.box(420, 588, 440, 112, "Policy match", [("endpoint litellm.litellm.svc.cluster.local:4000", "mk"),
      ("rule     POST /v1/chat/completions", "mk"), ("swap placeholder → real key, forward", "g")],
      icon="i-shield", kind="green", gap=20, lsize=13)
S.badge(420, 588, 4)
S.arrow("M862 730 H1256", GREEN_D)
S.label(1060, 722, "POST /v1/chat/completions · Bearer <real key>", GREEN_D, size=12.5)

S.arrow("M1264 770 H1474", GREY)
S.badge(1286, 770, 5)
S.label(1380, 762, "model call", GREY, size=12.5)
S.arrow("M1474 800 H1264", GREY, dash="6 4")
S.label(1370, 792, "completion", GREY, size=12.5)
S.arrow("M1256 834 H226", GREY, dash="6 4")
S.raw('<circle cx="620" cy="834" r="4" fill="#3d4652"/>')
S.label(420, 826, "response back to the agent", GREY, size=12.5)

# ---------------- denied
phase(870, "DENIED REQUEST", RED)
S.arrow("M224 912 H616", RED)
S.badge(246, 912, "✕", RED)
S.label(420, 903, "POST /key/generate", RED, size=12.5)
S.label(420, 930, "LiteLLM admin API", SUB, size=12.5, mono=False)

S.box(420, 948, 440, 74, "No L7 rule matches → denied", [("layer l7 · policy _provider_litellm", "mk"),
      "request never reaches LiteLLM"], icon="i-ban", kind="red", gap=19, lsize=13)
S.arrow("M616 1046 H226", RED, dash="6 4")
S.label(420, 1040, "403 Forbidden", RED, size=12.5)
S.box(40, 1058, 372, 58, "Agent receives", [('{"error":"policy_denied","layer":"l7",', "mk"),
      ('"policy":"_provider_litellm"}', "mk")], kind="red", gap=17, lsize=12.5, tsize=13.5, top=17)

S.arrow("M862 985 H908", RED, dash="6 4")
S.label(885, 977, "OCSF", RED, size=12)
S.box(910, 948, 400, 74, "Loki · OCSF audit log", [("OCSF HTTP:POST [MED] DENIED …", "mk"), "written by the supervisor"],
      icon="i-doc", kind="grey", gap=19, lsize=13)

# ---------------- takeaway
S.rect(24, H - 84, 1552, 60, fill=GREEN_T, stroke=GREEN_L, sw=1.2, rx=8)
S.icon("i-key", 38, H - 66, 22, GREEN_D)
S.text(70, H - 49, "The real key exists only in the gateway's provider store and on the supervisor's outbound request.", 15, True)
S.text(70, H - 30, "The agent process only ever holds the placeholder, so a prompt-injected agent has no key to leak.", 13.5, False, SUB)

S.save(sys.argv[1])
