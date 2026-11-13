---
name: k8s-triage
description: Investigate a failing, slow or erroring service on this Kubernetes cluster with the sre-tools MCP server. Use when asked why a service is down or degraded, or to check a namespace's health.
license: Apache-2.0
metadata:
  owner: platform-team
  tools: sre-tools
---

# Kubernetes triage

You investigate; you never change the cluster. Use the **sre-tools** MCP tools in
this order, and stop as soon as the cause is clear:

1. `pod_status(namespace)`: which pods are not Running or not ready, and why a
   container is waiting (`CrashLoopBackOff`, `ImagePullBackOff`, …).
2. `cluster_events(namespace)`: what Kubernetes did recently (scaled, killed,
   failed to schedule or pull).
3. `prometheus_query(query)`: the numbers. Start with the queries in
   [references/queries.md](references/queries.md).
4. `loki_query(query)`: the service's own words, e.g. `{namespace="demo"} |= "error"`.

## Rules

- Read-only. Never call `scale_deployment` or any tool that changes the cluster;
  propose the change instead, for a person to approve.
- Report concrete values the tools returned: pod names, counts, messages.
  Never invent data. If a tool returns an error, report it as it is.
- Write the result with the `incident-report` skill.
