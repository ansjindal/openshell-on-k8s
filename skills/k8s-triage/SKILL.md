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

1. `prometheus_query("kube_deployment_spec_replicas{namespace=\"<ns>\"}")` and
   `prometheus_query("kube_deployment_status_replicas_available{namespace=\"<ns>\"}")`:
   a Deployment that wants 0 replicas was **scaled down**, and everything that
   calls it fails. Desired above available means pods can't start.
2. `pod_status(namespace)`: which pods are not Running or not ready, and why a
   container is waiting (`CrashLoopBackOff`, `ImagePullBackOff`, …).
3. `cluster_events(namespace)`: what Kubernetes did recently (scaled, killed,
   failed to schedule or pull). A `ScalingReplicaSet … to 0` event names the
   cause directly.
4. `loki_query(query)`: the service's own words, e.g.
   `{namespace="demo", app="shop-app"} |= "error"`. More queries in
   [references/queries.md](references/queries.md).

A dependency at 0 replicas, a crash loop or a failed image pull outranks log
noise: warnings such as `fsnotify` or `too many open files` from sidecars and
log shippers are not the root cause unless nothing else is wrong.

## Rules

- Read-only. Never call `scale_deployment` or any tool that changes the cluster;
  propose the change instead, for a person to approve.
- Report concrete values the tools returned: pod names, counts, messages.
  Never invent data. If a tool returns an error, report it as it is.
- Write the result with the `incident-report` skill.
