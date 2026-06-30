/**
 * Telemetry proxy — the backend queries the in-cluster Prometheus (which scrapes LiteLLM) and
 * exposes a small curated API so the UI can show fleet token/cost without CORS or auth in the browser.
 * No OTel/Tempo is deployed on this cluster, so distributed traces aren't available — the UI uses our
 * own step + egress traces for that, and embeds Grafana panels for cluster/LiteLLM dashboards.
 */
const PROM = process.env.PROMETHEUS_URL ?? "http://kps-kube-prometheus-stack-prometheus.monitoring.svc.cluster.local:9090";
const GRAFANA_EMBED = process.env.GRAFANA_EMBED_URL ?? "/grafana";

export interface TelemetryConfig {
  prometheus: boolean;
  grafanaUrl: string;
  dashboards: { name: string; url: string }[]; // deep-linked Grafana dashboards (kiosk)
  tracesBackend: string | null; // null — no OTel/Tempo deployed
  note: string;
}

const dash = (uid: string, slug: string) => `${GRAFANA_EMBED}/d/${uid}/${slug}?orgId=1&kiosk&theme=dark&refresh=10s`;

export async function telemetryConfig(): Promise<TelemetryConfig> {
  let prometheus = false;
  try { const r = await fetch(`${PROM}/-/ready`, { signal: AbortSignal.timeout(3000) }); prometheus = r.ok; } catch { /* down */ }
  return {
    prometheus,
    grafanaUrl: GRAFANA_EMBED,
    // these dashboards are provisioned on the cluster by the fleet-demo monitoring role
    dashboards: [
      { name: "Incident Desk — Unified", url: dash("incident-desk-unified", "incident-desk-unified") },
      { name: "LiteLLM Proxy", url: dash("litellm-proxy", "litellm-proxy") },
      { name: "All dashboards", url: `${GRAFANA_EMBED}/dashboards` },
    ],
    tracesBackend: process.env.TRACES_BACKEND ?? "Tempo",
    note: prometheus ? "Live LiteLLM telemetry via Prometheus; per-run traces in Tempo." : "Prometheus unreachable — per-agent metrics still come from each model call.",
  };
}

/** Run an instant PromQL query; returns the scalar/vector result or null. */
export async function promQuery(q: string): Promise<any> {
  try {
    const r = await fetch(`${PROM}/api/v1/query?query=${encodeURIComponent(q)}`, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) return null;
    const j = await r.json();
    return j?.data?.result ?? null;
  } catch { return null; }
}

function firstScalar(result: any): number | null {
  if (Array.isArray(result) && result.length) { const v = Number(result[0]?.value?.[1]); return Number.isFinite(v) ? v : null; }
  return null;
}

export interface LiteLLMSummary {
  tokens: number | null; inputTokens: number | null; outputTokens: number | null;
  spendUsd: number | null; requests: number | null; inFlight: number | null;
  avgLatencySec: number | null; success: number | null; failure: number | null; source: string;
}

/** Curated LiteLLM fleet summary — metric names verified against this cluster's Prometheus. */
export async function litellmSummary(): Promise<LiteLLMSummary> {
  const tryAll = async (qs: string[]) => { for (const q of qs) { const v = firstScalar(await promQuery(q)); if (v != null) return v; } return null; };
  const [tokens, inputTokens, outputTokens, spendUsd, requests, inFlight, latSum, latCount, success, failure] = await Promise.all([
    tryAll(["sum(litellm_total_tokens_metric_total)"]),
    tryAll(["sum(litellm_input_tokens_metric_total)"]),
    tryAll(["sum(litellm_output_tokens_metric_total)"]),
    tryAll(["sum(litellm_spend_metric_total)"]),
    tryAll(["sum(litellm_proxy_total_requests_metric_total)", "sum(litellm_requests_metric_total)"]),
    tryAll(["sum(litellm_in_flight_requests)"]),
    tryAll(["sum(litellm_request_total_latency_metric_sum)"]),
    tryAll(["sum(litellm_request_total_latency_metric_count)"]),
    tryAll(["sum(litellm_deployment_success_responses_total)"]),
    tryAll(["sum(litellm_deployment_failure_responses_total)"]),
  ]);
  const avgLatencySec = latSum != null && latCount ? Number((latSum / latCount).toFixed(2)) : null;
  return { tokens, inputTokens, outputTokens, spendUsd, requests, inFlight, avgLatencySec, success, failure, source: "prometheus/litellm" };
}
