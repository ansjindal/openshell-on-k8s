export type AgentRole = "coordinator" | "investigator" | "synthesizer" | "sender";
export type SourceKind = "logs" | "metrics" | "traces" | "changes";
export type PolicyPosture = "strict" | "balanced" | "open" | "custom";

export interface Step {
  id: number; ts: string;
  kind: "plan" | "policy" | "fetch" | "egress" | "infer" | "think" | "finding" | "redirect" | "note" | "error";
  title: string; detail?: string; ok?: boolean;
}
export interface PolicyChip { posture?: PolicyPosture; allow: string[]; deny: string; rules?: string[]; }
export interface PolicyChange { ts: string; agent: string; posture: PolicyPosture; rules: string[]; by: string; note?: string; }
export interface SpawnInfo { provider: string; image: string; runtime: string; kind: string; createCmd: string; inference: string; reused: boolean; }
export interface EgressEvent { agent: string; decision: "allow" | "deny"; host: string; url?: string; method?: string; binary?: string; rule?: string; detail?: string; ts: string; }
export interface AgentMetrics { tokens?: number; promptTokens?: number; completionTokens?: number; costUsd?: number; latencyMs?: number; }
export interface AgentState {
  name: string; role: AgentRole; label: string; source?: SourceKind;
  phase: "pending" | "creating" | "policy" | "running" | "blocked" | "done" | "error";
  policy: PolicyChip; message?: string; query?: string; thinking?: string; result?: string;
  steps: Step[]; metrics?: AgentMetrics; spawn?: SpawnInfo;
}
export type RunStatus =
  | "starting" | "triage" | "investigating" | "awaiting-approval" | "synthesizing" | "sending" | "sent" | "rejected" | "cancelled" | "error";
export interface Run {
  id: string; traceId?: string; incidentId: string; title: string; symptoms: string; posture: PolicyPosture;
  live?: boolean; autopilot?: boolean; remediation?: { description: string; applied: boolean; note?: string; prUrl?: string; diff?: { key: string; before: string; after: string }[]; options?: { id: string; label: string; description: string }[] };
  status: RunStatus; gate?: "findings" | "runbook";
  agents: AgentState[]; egress: EgressEvent[]; policyAudit: PolicyChange[]; report?: string; error?: string; createdAt: string;
}
export interface Incident { id: string; title: string; severity: string; live?: boolean; }
export interface IncidentDetail { id: string; title: string; severity: string; symptoms: string; live?: boolean; remediation?: { description: string }; sources: { kind: SourceKind; label: string; hint: string }[]; }
export interface TelemetryConfig { prometheus: boolean; grafanaUrl: string; dashboards: { name: string; url: string }[]; tracesBackend: string | null; note: string; }
export interface LiteLLMSummary {
  tokens: number | null; inputTokens: number | null; outputTokens: number | null;
  spendUsd: number | null; requests: number | null; inFlight: number | null;
  avgLatencySec: number | null; success: number | null; failure: number | null; source: string;
}

const base = "/research-desk/api";

export interface RunSummary { id: string; incidentId: string; title: string; status: RunStatus; gate?: string; live?: boolean; createdAt: string; }
export async function listRuns(): Promise<RunSummary[]> { return (await fetch(`${base}/runs`)).json(); }
export async function getAutopilot(): Promise<{ enabled: boolean }> { return (await fetch(`${base}/autopilot`)).json(); }
export async function setAutopilotApi(enabled: boolean): Promise<{ enabled: boolean }> { return (await fetch(`${base}/autopilot`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled }) })).json(); }
export async function getRun(id: string): Promise<Run> { const r = await fetch(`${base}/runs/${id}`); if (!r.ok) throw new Error("not found"); return r.json(); }
export async function getIncidents(): Promise<Incident[]> { return (await fetch(`${base}/incidents`)).json(); }
export async function getIncident(id: string): Promise<IncidentDetail> { return (await fetch(`${base}/incidents/${id}`)).json(); }
export async function startRun(input: { incidentId: string; posture?: PolicyPosture }): Promise<Run> {
  const r = await fetch(`${base}/runs`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}
export async function approve(id: string) { await fetch(`${base}/runs/${id}/approve`, { method: "POST" }); }
export async function reject(id: string) { await fetch(`${base}/runs/${id}/reject`, { method: "POST" }); }
export async function remediateRun(id: string, option?: string) { await fetch(`${base}/runs/${id}/remediate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ option }) }); }
export async function triggerIncident(id: string) { const r = await fetch(`${base}/incidents/${id}/trigger`, { method: "POST" }); if (!r.ok) throw new Error((await r.json()).error); }
export interface AppHealth { status: "issue" | "healthy"; app?: string; p99: number | null; e5xxRate: number | null; okRate: number | null; poolInUse: number | null; poolMax: number | null; poolWaiting: number | null; restartRate?: number | null; restarts?: number | null; memMB?: number | null; podIssue?: boolean; podsSummary?: string; recentErrors: string[]; }
export async function appHealth(incident = "orders-pool"): Promise<AppHealth> { return (await fetch(`${base}/live/app?incident=${encodeURIComponent(incident)}`)).json(); }
export interface PodInfo { name: string; status: string; ready: string; restarts: number; lastReason?: string; age: string; }
export async function getPods(incident = "orders-pool"): Promise<{ namespace: string; pods: PodInfo[] }> { return (await fetch(`${base}/live/pods?incident=${encodeURIComponent(incident)}`)).json(); }
export async function cancelRun(id: string) { await fetch(`${base}/runs/${id}/cancel`, { method: "POST" }); }
export async function redirectAgent(id: string, agent: string, hypothesis?: string) {
  await fetch(`${base}/runs/${id}/redirect`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agent, hypothesis }) });
}
export async function hotReloadPolicy(id: string, target: string, posture: PolicyPosture, custom?: string[]) {
  await fetch(`${base}/runs/${id}/policy`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ target, posture, custom }) });
}
export async function getLogs(name: string): Promise<string> { return (await fetch(`${base}/agents/${encodeURIComponent(name)}/logs`)).text(); }
export async function getPolicy(name: string): Promise<string> { return (await fetch(`${base}/agents/${encodeURIComponent(name)}/policy`)).text(); }
export async function getPolicyHistory(name: string): Promise<string> { return (await fetch(`${base}/agents/${encodeURIComponent(name)}/policy/history`)).text(); }
export async function telemetryConfig(): Promise<TelemetryConfig> { return (await fetch(`${base}/telemetry/config`)).json(); }
export async function litellmSummary(): Promise<LiteLLMSummary> { return (await fetch(`${base}/telemetry/litellm`)).json(); }

export function streamRun(id: string, onEvent: (e: any) => void): () => void {
  const es = new EventSource(`${base}/runs/${id}/stream`);
  es.onmessage = (m) => { try { onEvent(JSON.parse(m.data)); } catch { /* ignore */ } };
  return () => es.close();
}
