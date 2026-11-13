---
name: incident-report
description: Write a short, evidence-based incident report. Use whenever you finish investigating an outage or degradation and need to report what you found.
license: Apache-2.0
metadata:
  owner: platform-team
---

# Incident report

Reply with exactly these four sections, in this order, and nothing else:

**Summary**: one sentence: what is broken, for whom.

**Evidence**: two to five bullets, each a concrete value a tool returned, with
the tool's name, e.g. `pod_status: payments has 0 pods`.

**Root cause**: one or two sentences. If the evidence doesn't show it, say
"unknown" and what you would check next.

**Proposed fix**: the one change you recommend, as a command or a tool call,
for a person to approve. Never apply it yourself.
