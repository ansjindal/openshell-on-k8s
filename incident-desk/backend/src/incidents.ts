/**
 * Scripted incidents for the human-in-the-loop RCA use case.
 *
 * The backend serves each incident's evidence at distinct paths
 * (/incident/:id/{logs,metrics,traces,changes}). Each investigator sandbox is given an egress
 * policy scoped to EXACTLY ONE of those paths — so the "logs" investigator literally cannot read
 * /metrics, etc. That per-agent path scoping is the policy story; correlation happens only after a
 * human approves and the synthesizer combines the findings.
 *
 * Evidence is plain text (the agent curls it and reasons over it). Each incident has a discoverable
 * root cause that no single source reveals alone.
 */

export type SourceKind = "logs" | "metrics" | "traces" | "changes";

export interface IncidentSource {
  kind: SourceKind;
  label: string; // human label, e.g. "Application logs (Loki)"
  hint: string; // what an investigator should look for
  body: string; // the evidence text the agent fetches
}

export interface FileEdit { path: string; find?: string; replace?: string; content?: string }
export interface FixOption { id: string; label: string; description: string; branch: string; title: string; body: string; edits: FileEdit[] }
export type Remediation =
  | { kind: "configmap"; namespace: string; configMap: string; restart: string;
      set: Record<string, string>; fault: { key: string; value: string }; description: string }
  | { kind: "gitops"; gitFile: string; goodContent: string; faultContent: string;
      options: FixOption[]; description: string };

/** For live incidents: where the real app + its telemetry live. */
export interface LiveConfig { namespace: string; app: string; otelService: string; changes: "k8s" | "git"; gitFile?: string; }
export interface Incident {
  id: string;
  title: string;
  severity: string; // SEV1 / SEV2 ...
  symptoms: string; // the alert / what the human reports
  live?: boolean; // true → evidence is pulled live from Loki/Prometheus/Tempo/k8s (real app)
  liveConfig?: LiveConfig; // where the live app + telemetry are
  remediation?: Remediation; // a real config fix the operator can apply (human-approved)
  sources: IncidentSource[];
  // a short ground-truth note used only to sanity-check demos (never shown to agents)
  rootCauseNote: string;
}

const LIVE_SRC = (kind: SourceKind, label: string, hint: string): IncidentSource => ({ kind, label, hint, body: "(fetched live at run time)" });
const ORDERS: Incident = {
  id: "orders-pool",
  title: "orders-api p99 latency + 5xx (LIVE)",
  severity: "SEV2",
  live: true,
  liveConfig: { namespace: "demo-shop", app: "orders-api", otelService: "orders-api", changes: "k8s" },
  symptoms:
    "Live incident on the real orders-api (demo-shop): checkout p99 latency is elevated and a portion of /orders requests return HTTP 503. Traffic is steady. Investigate with the real logs/metrics/traces and recommend a fix.",
  rootCauseNote: "orders-config DB_POOL_MAX=10 is too small for the offered load → pool acquire waits/timeouts → 503. Fix: raise DB_POOL_MAX to 50 and roll orders-api.",
  remediation: {
    kind: "configmap", namespace: "demo-shop", configMap: "orders-config", restart: "orders-api",
    set: { DB_POOL_MAX: "50", BUILD: "v2.3.2" },
    fault: { key: "DB_POOL_MAX", value: "10" },
    description: "Roll forward: restore the DB connection pool (DB_POOL_MAX 10→50) and bump the build to v2.3.2 — reverting PR #412's 'cost-tuning' pool reduction. Then roll orders-api.",
  },
  sources: [
    LIVE_SRC("logs", "Application logs (Loki)", "error lines, pool acquire timeouts"),
    LIVE_SRC("metrics", "Prometheus metrics", "latency, 503 rate, db pool saturation"),
    LIVE_SRC("traces", "Distributed traces (Tempo)", "which span dominates latency"),
    LIVE_SRC("changes", "Config & deploy (Kubernetes)", "current pool size / recent config"),
  ],
};

const CHECKOUT: Incident = {
  id: "checkout-latency",
  title: "Checkout p99 latency spike + 5xx on payments-svc",
  severity: "SEV2",
  symptoms:
    "Since ~14:02 UTC, checkout p99 latency rose from 180ms to 5.2s and the HTTP 5xx rate on payments-svc climbed to ~12%. Customers report payment failures at the final step. No infra alerts for node CPU/mem. On-call wants a root cause and a remediation runbook.",
  rootCauseNote:
    "Deploy payments-svc v2.3.1 (14:02) reduced db.pool.maxConnections 50->10. Under normal load the pool is exhausted; requests block on pool acquire (~4.8s) then 5xx. Fix: rollback or restore pool max.",
  sources: [
    {
      kind: "logs",
      label: "Application logs",
      hint: "errors, stack traces, timeouts, and any deploy/restart markers",
      body: [
        "2026-06-22T14:01:40Z payments-svc INFO  checkout handler ok latency_ms=176",
        "2026-06-22T14:02:03Z payments-svc INFO  >>> process started build=v2.3.1 commit=9f3ac21",
        "2026-06-22T14:02:55Z payments-svc WARN  db pool acquire slow waited_ms=1200 pool_in_use=10 pool_max=10",
        "2026-06-22T14:03:10Z payments-svc ERROR db pool acquire timeout waited_ms=5000 pool_in_use=10 pool_max=10",
        "2026-06-22T14:03:10Z payments-svc ERROR checkout failed err=\"timeout acquiring connection from pool\" status=503",
        "2026-06-22T14:03:42Z payments-svc ERROR pq: FATAL remaining connection slots are reserved for non-replication superuser connections",
        "2026-06-22T14:05:18Z payments-svc ERROR checkout failed err=\"context deadline exceeded\" status=503 trace_id=7c1a9e",
        "2026-06-22T14:08:00Z payments-svc WARN  pool_in_use=10 pool_max=10 waiters=37 (sustained)",
        "... (errors continue, all point at db connection pool exhaustion since 14:02) ...",
      ].join("\n"),
    },
    {
      kind: "metrics",
      label: "Prometheus metrics",
      hint: "latency, error rate, saturation; look for what saturates and when it starts",
      body: [
        "# series sampled at 1m, window 13:55-14:15 UTC",
        "http_request_duration_p99_seconds{svc=payments} : 0.18 0.18 0.19 | 14:02 -> 1.9 3.8 5.2 5.1 5.3 (sustained)",
        "http_requests_5xx_ratio{svc=payments}          : 0.00 0.00 0.00 | 14:02 -> 0.04 0.09 0.12 0.12 0.12",
        "db_connections_active{svc=payments}            : 7 8 7  | 14:02 -> 10 10 10 10 10  (== db_pool_max)",
        "db_pool_max{svc=payments}                      : 50 50 50 | 14:02 -> 10 10 10 10 10  (DROPPED at 14:02)",
        "db_pool_acquire_wait_seconds_p99{svc=payments} : 0.002 | 14:02 -> 1.2 3.9 4.8 4.8 4.9",
        "node_cpu_utilization{svc=payments}             : 0.31 0.33 0.30 0.34 (flat — not CPU bound)",
        "container_memory_working_set_ratio{svc=payments}: 0.42 0.43 0.42 (flat — not OOM)",
      ].join("\n"),
    },
    {
      kind: "traces",
      label: "Distributed traces",
      hint: "which span dominates the latency",
      body: [
        "trace 7c1a9e (checkout, total 5012ms):",
        "  span gateway.route                 4ms",
        "  span payments-svc.checkout         5008ms",
        "    span db.pool.acquire             4806ms  <-- dominant; waiting for a free connection",
        "    span db.query SELECT order        38ms",
        "    span db.query UPDATE balance      21ms",
        "  span notify.email                  (skipped, request already failed)",
        "summary: 95% of checkout latency is db.pool.acquire wait, not query execution.",
      ].join("\n"),
    },
    {
      kind: "changes",
      label: "Deploys & config changes",
      hint: "recent deploys/config edits near the incident start",
      body: [
        "2026-06-21T22:10Z  payments-svc v2.3.0  routine deploy (no config change)",
        "2026-06-22T14:02Z  payments-svc v2.3.1  DEPLOY  by ci-bot  rollout=RollingUpdate",
        "                   config diff (helm values):",
        "                     - db.pool.maxConnections: 50",
        "                     + db.pool.maxConnections: 10   # 'cost tuning' per PR #412",
        "                     readinessProbe: unchanged",
        "2026-06-22T14:02Z  no database, node, or network changes in this window",
      ].join("\n"),
    },
  ],
};

const OOM: Incident = {
  id: "search-oom",
  title: "search-api pods CrashLoopBackOff after release",
  severity: "SEV2",
  symptoms:
    "search-api pods are restarting in a loop since ~09:20 UTC; search results intermittently 502. Restarts climb after the morning release. Need root cause + runbook.",
  rootCauseNote:
    "Release search-api v5.1 raised in-memory cache cap (cacheSizeMB 256->2048) above the container memory limit (1Gi). Pods OOMKill under load. Fix: lower cache cap or raise limit.",
  sources: [
    {
      kind: "logs",
      label: "Application logs",
      hint: "exit reasons, OOM, restart markers",
      body: [
        "2026-06-22T09:19:50Z search-api INFO starting build=v5.1 cache_cap_mb=2048",
        "2026-06-22T09:24:12Z search-api WARN heap rss_mb=910 cap_mb=2048 limit_mb=1024",
        "2026-06-22T09:24:31Z kubelet     Memory cgroup out of memory: Killed process (search-api) ",
        "2026-06-22T09:24:31Z search-api  last state: OOMKilled exit_code=137 restarts=6",
        "... CrashLoopBackOff, restarts climbing ...",
      ].join("\n"),
    },
    {
      kind: "metrics",
      label: "Prometheus metrics",
      hint: "memory vs limit, restarts",
      body: [
        "container_memory_working_set_ratio{svc=search-api}: 0.4 | 09:20 -> 0.7 0.9 0.99 1.0 (hits limit)",
        "kube_pod_container_status_restarts_total{svc=search-api}: 0 | 09:20 -> 1 3 6 9 (climbing)",
        "container_memory_limit_bytes{svc=search-api}: 1073741824 (1Gi, unchanged)",
        "node memory pressure: none (other pods healthy)",
      ].join("\n"),
    },
    {
      kind: "traces",
      label: "Distributed traces",
      hint: "where time/memory goes",
      body: [
        "trace ab12 (search, partial — process killed mid-request):",
        "  span search.query        220ms",
        "    span cache.warm         (allocates up to cache_cap_mb=2048) <-- exceeds 1Gi limit",
        "summary: memory growth tracks cache warm, not query volume.",
      ].join("\n"),
    },
    {
      kind: "changes",
      label: "Deploys & config changes",
      hint: "recent release/config edits",
      body: [
        "2026-06-22T09:18Z search-api v5.1 DEPLOY by release-bot",
        "  config diff: cacheSizeMB: 256 -> 2048   # 'improve hit rate' PR #889",
        "  resources.limits.memory: 1Gi (UNCHANGED)",
        "2026-06-22T09:18Z no node/db/network changes",
      ].join("\n"),
    },
  ],
};

const GITOPS_GOOD = "DB_POOL_MAX=50\nCACHE_MB=64\nBUILD=v2.3.4\n"; // fix-forward (not a version rollback)
const GITOPS_BAD = "DB_POOL_MAX=10\nCACHE_MB=400\nBUILD=v2.3.3\n";
const GITOPS: Incident = {
  id: "gitops-oom",
  title: "catalog-api OOM crashloop + 5xx (GitOps)",
  severity: "SEV1",
  live: true,
  liveConfig: { namespace: "demo-shop-gitops", app: "catalog-api", otelService: "catalog-api", changes: "git", gitFile: "apps/catalog/config.env" },
  symptoms:
    "Live incident on the ArgoCD-managed catalog-api (demo-shop-gitops): pods are OOMKill-crashlooping and /orders returns 5xx. A recent GitOps config change is suspected. Investigate from live telemetry + the Git config, and propose a fix via pull request (human-merged).",
  rootCauseNote: "apps/catalog/config.env committed CACHE_MB=400 (> the 256Mi memory limit → OOMKilled) and DB_POOL_MAX=10. Fix PR restores CACHE_MB=64, DB_POOL_MAX=50.",
  remediation: {
    kind: "gitops", gitFile: "apps/catalog/config.env", goodContent: GITOPS_GOOD, faultContent: GITOPS_BAD,
    description: "Two valid fixes for the OOM (the agents flagged both): revert the oversized cache to fit the limit, OR raise the container memory limit to fit the cache. Both also restore the DB pool. Pick one — it opens a PR a human reviews + merges; ArgoCD then syncs and catalog-api recovers.",
    options: [
      {
        id: "revert-config", label: "Revert config (recommended)",
        description: "Shrink CACHE_MB 400→64 (back under the 256Mi limit) + DB_POOL_MAX 10→50. Reverts the regression at no extra cost.",
        branch: "fix/revert-cache-and-pool", title: "fix(catalog): revert cache+pool regression (OOM)",
        body: "Reverts the config regression that set `CACHE_MB=400` (above the 256Mi container memory limit → OOMKilled) and cut `DB_POOL_MAX` to 10. Restores `CACHE_MB=64` + `DB_POOL_MAX=50`.\n\nProposed by the OpenShell Incident Desk fleet.",
        edits: [{ path: "apps/catalog/config.env", content: GITOPS_GOOD }],
      },
      {
        id: "raise-memory", label: "Raise memory limit",
        description: "Keep the larger cache; raise the container memory limit 256Mi→512Mi so the 400MB cache fits + DB_POOL_MAX 10→50. Costs more memory.",
        branch: "fix/raise-memory-limit", title: "fix(catalog): raise memory limit 256Mi→512Mi + restore pool",
        body: "Alternative fix: instead of shrinking the cache, raise the container memory limit `256Mi→512Mi` so the 400MB cache fits (no OOM), and restore `DB_POOL_MAX 10→50`. Trades more memory for keeping the larger cache.\n\nProposed by the OpenShell Incident Desk fleet.",
        edits: [
          { path: "apps/catalog/catalog-api.yaml", find: "memory: 256Mi", replace: "memory: 512Mi" },
          { path: "apps/catalog/config.env", content: "DB_POOL_MAX=50\nCACHE_MB=400\nBUILD=v2.3.4\n" },
        ],
      },
    ],
  },
  sources: [
    LIVE_SRC("logs", "Application logs (Loki)", "OOM / crashloop markers, cache-warm size, pool errors"),
    LIVE_SRC("metrics", "Prometheus metrics", "restarts, memory vs limit, 503 rate, pool saturation"),
    LIVE_SRC("traces", "Distributed traces (Tempo)", "latency-dominant span when up"),
    LIVE_SRC("changes", "GitOps config (GitHub + ArgoCD)", "the committed config.env / recent change"),
  ],
};

const INCIDENTS: Incident[] = [ORDERS, GITOPS, CHECKOUT, OOM];

export function listIncidents(): { id: string; title: string; severity: string; live: boolean }[] {
  return INCIDENTS.map((i) => ({ id: i.id, title: i.title, severity: i.severity, live: !!i.live }));
}
export function getIncident(id: string): Incident | undefined {
  return INCIDENTS.find((i) => i.id === id);
}
export function getSource(id: string, kind: string): IncidentSource | undefined {
  return getIncident(id)?.sources.find((s) => s.kind === kind);
}
