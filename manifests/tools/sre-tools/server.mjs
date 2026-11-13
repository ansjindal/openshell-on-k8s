// sre-tools: a small MCP server (Streamable HTTP, stateless) that gives agents
// the cluster's SRE tools: pod status, events, Prometheus, Loki, and one write
// tool, scale_deployment. It runs as an ordinary Deployment + Service in the
// `tools` namespace; agents reach it at http://sre-tools.tools.svc.cluster.local:8080/mcp,
// and OpenShell decides, per sandbox, which tools each agent may call.
import http from "node:http";
import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const PROM = process.env.PROMETHEUS_URL || "http://kps-kube-prometheus-stack-prometheus.monitoring.svc.cluster.local:9090";
const LOKI = process.env.LOKI_URL || "http://loki.monitoring.svc.cluster.local:3100";
const SA = "/var/run/secrets/kubernetes.io/serviceaccount";
const KUBE = "https://kubernetes.default.svc";
const token = () => readFileSync(`${SA}/token`, "utf8");
const cap = (s, n = 3000) => (s.length > n ? s.slice(0, n) + "\n…(truncated)" : s);
const text = (t) => ({ content: [{ type: "text", text: cap(t) }] });

async function kube(path, init = {}) {
  const r = await fetch(KUBE + path, { ...init, headers: { Authorization: `Bearer ${token()}`, ...(init.headers || {}) } });
  const body = await r.text();
  if (!r.ok) throw new Error(`kubernetes ${r.status}: ${body.slice(0, 300)}`);
  return JSON.parse(body);
}

function tools() {
  const s = new McpServer({ name: "sre-tools", version: "1.0.0" });

  s.registerTool("pod_status", {
    title: "Pod status",
    description: "List the pods in a namespace with phase, readiness, restarts and why a container is waiting. Read-only.",
    inputSchema: { namespace: z.string().describe("Kubernetes namespace, e.g. demo") },
    annotations: { readOnlyHint: true },
  }, async ({ namespace }) => {
    const j = await kube(`/api/v1/namespaces/${encodeURIComponent(namespace)}/pods`);
    const rows = j.items.map((p) => {
      const cs = p.status.containerStatuses || [];
      const ready = cs.filter((c) => c.ready).length;
      const restarts = cs.reduce((n, c) => n + c.restartCount, 0);
      const waiting = cs.map((c) => c.state?.waiting?.reason).filter(Boolean).join(",");
      return `${p.metadata.name}  ${p.status.phase}  ready ${ready}/${cs.length}  restarts ${restarts}${waiting ? "  waiting: " + waiting : ""}`;
    });
    return text(rows.length ? rows.join("\n") : `no pods in ${namespace}`);
  });

  s.registerTool("cluster_events", {
    title: "Kubernetes events",
    description: "The most recent Kubernetes events in a namespace (reason, object, message). Read-only.",
    inputSchema: { namespace: z.string(), limit: z.number().int().min(1).max(50).optional() },
    annotations: { readOnlyHint: true },
  }, async ({ namespace, limit = 15 }) => {
    const j = await kube(`/api/v1/namespaces/${encodeURIComponent(namespace)}/events`);
    const ev = j.items
      .sort((a, b) => new Date(b.lastTimestamp || b.eventTime || 0) - new Date(a.lastTimestamp || a.eventTime || 0))
      .slice(0, limit)
      .map((e) => `${e.type} ${e.reason} ${e.involvedObject.kind}/${e.involvedObject.name}: ${e.message}`);
    return text(ev.length ? ev.join("\n") : `no events in ${namespace}`);
  });

  s.registerTool("prometheus_query", {
    title: "Prometheus query",
    description: "Run an instant PromQL query against the cluster's Prometheus and return each series' labels and value. Read-only.",
    inputSchema: { query: z.string().describe("PromQL, e.g. kube_deployment_status_replicas_available{namespace=\"demo\"}") },
    annotations: { readOnlyHint: true },
  }, async ({ query }) => {
    const r = await fetch(`${PROM}/api/v1/query?query=${encodeURIComponent(query)}`);
    const j = await r.json();
    if (j.status !== "success") return text(`ERR ${j.error || r.status}`);
    // keep the labels that matter; kube-state-metrics series carry its own pod as `pod`
    const keep = ["namespace", "deployment", "pod", "container", "reason", "phase"];
    const rows = j.data.result.slice(0, 20).map((s) => {
      const m = s.job === "kube-state-metrics" || s.metric.job === "kube-state-metrics" ? { ...s.metric, pod: undefined, container: undefined } : s.metric;
      const l = Object.fromEntries(keep.filter((k) => m[k]).map((k) => [k, m[k]]));
      return `${JSON.stringify(l)} => ${s.value?.[1]}`;
    });
    return text(rows.length ? rows.join("\n") : "no series");
  });

  s.registerTool("loki_query", {
    title: "Loki query",
    description: "Run a LogQL query over the last N minutes and return the newest lines. Read-only.",
    inputSchema: { query: z.string().describe("LogQL, e.g. {namespace=\"demo\"} |= \"error\""), minutes: z.number().int().min(1).max(120).optional() },
    annotations: { readOnlyHint: true },
  }, async ({ query, minutes = 15 }) => {
    const start = (Date.now() - minutes * 60_000) * 1e6;
    const r = await fetch(`${LOKI}/loki/api/v1/query_range?limit=20&direction=backward&start=${start}&query=${encodeURIComponent(query)}`);
    const j = await r.json();
    if (j.status !== "success") return text(`ERR ${j.error || r.status}`);
    const lines = j.data.result.flatMap((s) => s.values.map(([, l]) => `${s.stream.pod || s.stream.app || ""} ${l}`)).slice(0, 20);
    return text(lines.length ? lines.join("\n") : "no lines");
  });

  s.registerTool("scale_deployment", {
    title: "Scale a deployment",
    description: "Set a Deployment's replica count. Changes the cluster: only in the demo namespace, and only where policy allows it.",
    inputSchema: { namespace: z.string(), name: z.string(), replicas: z.number().int().min(0).max(10) },
    annotations: { destructiveHint: true },
  }, async ({ namespace, name, replicas }) => {
    await kube(`/apis/apps/v1/namespaces/${encodeURIComponent(namespace)}/deployments/${encodeURIComponent(name)}/scale`, {
      method: "PATCH", headers: { "Content-Type": "application/merge-patch+json" },
      body: JSON.stringify({ spec: { replicas } }),
    });
    return text(`scaled ${namespace}/${name} to ${replicas}`);
  });

  return s;
}

http.createServer(async (req, res) => {
  if (req.url === "/healthz") { res.writeHead(200).end("ok"); return; }
  if (!req.url?.startsWith("/mcp")) { res.writeHead(404).end(); return; }
  // Stateless: a fresh server and transport per request, no session ids.
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  res.on("close", () => transport.close());
  try {
    await tools().connect(transport);
    await transport.handleRequest(req, res);
  } catch (e) {
    if (!res.headersSent) res.writeHead(500, { "Content-Type": "application/json" }).end(JSON.stringify({ error: String(e) }));
  }
}).listen(8080, () => console.log("sre-tools MCP server on :8080/mcp"));
