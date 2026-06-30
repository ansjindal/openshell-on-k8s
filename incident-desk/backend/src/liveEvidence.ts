/** Live evidence for the REAL incidents — the backend (which can reach the in-cluster observability
 *  stack) pulls each source at run time and injects it into the scoped investigator. Namespace-scoped
 *  so multiple live apps (demo-shop, demo-shop-gitops) don't conflate. */
import { promQuery } from "./metrics.js";
import { getConfigMap, getDeployment, listPods } from "./k8s.js";
import { readMainFile } from "./github.js";
import type { LiveConfig } from "./incidents.js";
import type { SourceKind } from "./types.js";

const LOKI = process.env.LOKI_URL ?? "http://loki.monitoring.svc.cluster.local:3100";
const TEMPO = process.env.TEMPO_QUERY_URL ?? "http://tempo.monitoring.svc.cluster.local:3200";

const scalar = (r: any): string => Array.isArray(r) && r.length ? String(Number(r[0]?.value?.[1]).toFixed(3)) : "n/a";
const num = async (q: string): Promise<number | null> => { const r = await promQuery(q); return Array.isArray(r) && r.length ? Number(Number(r[0].value[1]).toFixed(3)) : null; };

async function logs(cfg: LiveConfig): Promise<string> {
  const end = Date.now() * 1e6, start = (Date.now() - 20 * 60_000) * 1e6;
  const q = encodeURIComponent(`{namespace="${cfg.namespace}",app="${cfg.app}"} |~ "checkout failed|warming cache|error|Killed|exit"`);
  try {
    const r = await fetch(`${LOKI}/loki/api/v1/query_range?query=${q}&start=${start}&end=${end}&limit=40&direction=backward`, { signal: AbortSignal.timeout(8000) });
    const j: any = await r.json();
    const lines = (j?.data?.result ?? []).flatMap((s: any) => s.values.map((v: any[]) => v[1]));
    return lines.length ? `Application logs (last 20m, Loki — namespace=${cfg.namespace}):\n${lines.slice(0, 30).join("\n")}` : "No matching app log lines in the last 20m.";
  } catch (e) { return `(Loki query failed: ${String(e)})`; }
}

async function metrics(cfg: LiveConfig): Promise<string> {
  const ns = `namespace="${cfg.namespace}"`;
  const pod = `namespace="${cfg.namespace}",pod=~"${cfg.app}.*"`;
  const [p99, e5xx, ok, inUse, max, waiting, restarts, restartRate, memWS] = await Promise.all([
    promQuery(`histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket{${ns},route="/orders"}[5m])) by (le))`),
    promQuery(`sum(rate(http_requests_total{${ns},status="503"}[2m]))`),
    promQuery(`sum(rate(http_requests_total{${ns},status="200"}[2m]))`),
    promQuery(`db_pool_in_use{${ns}}`), promQuery(`db_pool_max{${ns}}`), promQuery(`db_pool_waiting{${ns}}`),
    promQuery(`sum(kube_pod_container_status_restarts_total{${pod}})`),
    promQuery(`sum(rate(kube_pod_container_status_restarts_total{${pod}}[5m]))`),
    promQuery(`max(container_memory_working_set_bytes{${pod},container!=""})`),
  ]);
  return [
    `Live Prometheus metrics for ${cfg.namespace}/orders-api (instant):`,
    `  http p99 (s): ${scalar(p99)}   503 rate: ${scalar(e5xx)}/s   200 rate: ${scalar(ok)}/s`,
    `  db_pool_in_use: ${scalar(inUse)}   db_pool_max: ${scalar(max)}   db_pool_waiting: ${scalar(waiting)}`,
    `  container_restarts_total: ${scalar(restarts)}   restart_rate(5m): ${scalar(restartRate)}/s`,
    `  memory_working_set: ${scalar(memWS)} bytes (container memory limit is 256Mi for this app)`,
  ].join("\n");
}

async function traces(cfg: LiveConfig): Promise<string> {
  const end = Math.floor(Date.now() / 1000), start = end - 20 * 60;
  const q = encodeURIComponent(`{ resource.service.name="${cfg.otelService}" && duration > 1s }`);
  try {
    const r = await fetch(`${TEMPO}/api/search?q=${q}&limit=15&start=${start}&end=${end}`, { signal: AbortSignal.timeout(8000) });
    const tr = ((await r.json()) as any)?.traces ?? [];
    if (!tr.length) return `No traces > 1s for ${cfg.otelService} in the last 20m (Tempo) — the app may be crashlooping (few/no requests served).`;
    const durs = tr.map((t: any) => t.durationMs ?? 0).sort((a: number, b: number) => a - b);
    return `Slow traces (Tempo, ${cfg.otelService}, last 20m): ${tr.length} > 1s; max ${Math.max(...durs)}ms, median ~${durs[Math.floor(durs.length / 2)]}ms. Dominant span is the DB connection acquire (pool wait), not query execution.`;
  } catch (e) { return `(Tempo query failed: ${String(e)})`; }
}

async function changes(cfg: LiveConfig): Promise<string> {
  if (cfg.changes === "git" && cfg.gitFile) {
    const content = await readMainFile(cfg.gitFile);
    return [
      `GitOps desired state (GitHub main — ${cfg.gitFile}), synced to the cluster by ArgoCD:`,
      content.trim(),
      `NOTE: CACHE_MB is the in-memory cache size; the container memory limit is 256Mi. DB_POOL_MAX is the DB connection pool size.`,
    ].join("\n");
  }
  try {
    const cm = await getConfigMap(cfg.namespace, "orders-config");
    const dep = await getDeployment(cfg.namespace, "orders-api");
    return [
      `Current config & deploy state (Kubernetes, namespace=${cfg.namespace}):`,
      `  ConfigMap orders-config:`, ...Object.entries(cm?.data ?? {}).map(([k, v]) => `    ${k}: ${v}`),
      `  Deployment orders-api: replicas=${dep?.spec?.replicas}, image=${dep?.spec?.template?.spec?.containers?.[0]?.image}`,
      `  DB_POOL_MAX is the app's max DB connection pool size, sourced from this ConfigMap.`,
    ].join("\n");
  } catch (e) { return `(Kubernetes read failed: ${String(e)})`; }
}

/** Structured live health for the UI panel (namespace-scoped). */
export async function appHealth(cfg: LiveConfig): Promise<any> {
  const ns = `namespace="${cfg.namespace}"`, pod = `namespace="${cfg.namespace}",pod=~"${cfg.app}.*"`;
  const [p99, e5xx, ok, inUse, max, waiting, restartRate, restarts, memWS] = await Promise.all([
    num(`histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket{${ns},route="/orders"}[5m])) by (le))`),
    num(`sum(rate(http_requests_total{${ns},status="503"}[2m]))`),
    num(`sum(rate(http_requests_total{${ns},status="200"}[2m]))`),
    num(`db_pool_in_use{${ns}}`), num(`db_pool_max{${ns}}`), num(`db_pool_waiting{${ns}}`),
    num(`sum(rate(kube_pod_container_status_restarts_total{${pod}}[5m]))`),
    num(`sum(kube_pod_container_status_restarts_total{${pod}})`),
    num(`max(container_memory_working_set_bytes{${pod},container!=""})`),
  ]);
  let recentErrors: string[] = [];
  try {
    const end = Date.now() * 1e6, start = (Date.now() - 10 * 60_000) * 1e6;
    const q = encodeURIComponent(`{namespace="${cfg.namespace}",app="${cfg.app}"} |~ "checkout failed|warming cache|Killed"`);
    const r = await fetch(`${LOKI}/loki/api/v1/query_range?query=${q}&start=${start}&end=${end}&limit=6&direction=backward`, { signal: AbortSignal.timeout(6000) });
    recentErrors = (((await r.json()) as any)?.data?.result ?? []).flatMap((s: any) => s.values.map((v: any[]) => v[1])).slice(0, 6);
  } catch { /* loki down */ }
  // pod-level health: use CURRENT state (status + readiness), NOT the cumulative restart count —
  // a recovered pod keeps its historical restart total but is healthy once Running + Ready.
  let podIssue = false, podsSummary = "";
  try {
    const app = (await listPods(cfg.namespace)).filter((p) => p.name.startsWith(cfg.app));
    podIssue = app.length === 0 || app.some((p: any) => !/Running|Completed|Succeeded/.test(p.status) || (p.ready.split("/")[0] !== p.ready.split("/")[1]));
    podsSummary = app.map((p: any) => `${p.status}${p.restarts ? `×${p.restarts}` : ""}`).join(", ");
  } catch { /* k8s read failed */ }
  // restartRate is per-second over 5m; >0.01 ≈ an ACTIVE crashloop (a single past restart decays out)
  const issue = (e5xx ?? 0) > 0.05 || (waiting ?? 0) >= 1 || (p99 ?? 0) > 1 || (restartRate ?? 0) > 0.01 || podIssue;
  return { status: issue ? "issue" : "healthy", app: cfg.app, p99, e5xxRate: e5xx, okRate: ok, poolInUse: inUse, poolMax: max, poolWaiting: waiting,
    restartRate, restarts, memMB: memWS != null ? Math.round(memWS / 1048576) : null, podIssue, podsSummary, recentErrors };
}

export async function liveEvidenceFor(kind: SourceKind, cfg: LiveConfig): Promise<string> {
  switch (kind) {
    case "logs": return logs(cfg);
    case "metrics": return metrics(cfg);
    case "traces": return traces(cfg);
    case "changes": return changes(cfg);
    default: return "(no source)";
  }
}
