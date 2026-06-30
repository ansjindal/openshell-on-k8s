// Roles in the RCA fleet:
//   coordinator  — triage: reads symptoms, forms hypotheses, assigns one source per investigator
//   investigator — locked to ONE evidence source (logs|metrics|traces|changes) by egress policy
//   synthesizer  — correlates approved findings into a root cause + remediation runbook
//   sender       — delivers the runbook (mail-scoped)
export type AgentRole = "coordinator" | "investigator" | "synthesizer" | "sender";

export type AgentPhase =
  | "pending"
  | "creating"
  | "policy"
  | "running"
  | "blocked" // waiting on a human decision (redirect/approve)
  | "done"
  | "error";

export type SourceKind = "logs" | "metrics" | "traces" | "changes";

/** A single step in an agent's step-by-step path (the timeline / decision trail). */
export interface Step {
  id: number;
  ts: string;
  kind: "plan" | "policy" | "fetch" | "egress" | "infer" | "think" | "finding" | "redirect" | "note" | "error";
  title: string;
  detail?: string;
  ok?: boolean; // for fetch/egress: allowed/succeeded vs denied/failed
}

export type PolicyPosture = "strict" | "balanced" | "open" | "custom";

export interface PolicyChip {
  posture?: PolicyPosture;
  allow: string[]; // short chips, e.g. ["incident logs", "inference.local"]
  deny: string; // human label, e.g. "every other source"
  rules?: string[]; // the actual egress rules applied (what the L7 proxy enforces)
}

/** One entry in the live policy change audit. */
export interface PolicyChange {
  ts: string;
  agent: string;
  posture: PolicyPosture;
  rules: string[];
  by: string; // "operator" (UI) | "system" (initial apply)
  note?: string;
}

/** How an agent's sandbox was spun up (shown in the UI). */
export interface SpawnInfo {
  provider: string;
  image: string;
  runtime: string;
  kind: string;
  createCmd: string;
  inference: string;
  reused: boolean;
}

export interface EgressEvent {
  agent: string;
  decision: "allow" | "deny";
  host: string;
  url?: string;
  method?: string;
  binary?: string;
  rule?: string; // which policy rule matched (the structured policy-decision trace)
  detail?: string; // HTTP status or block reason
  ts: string;
}

/** Token/cost/latency for an agent's model call(s). */
export interface AgentMetrics {
  tokens?: number;
  promptTokens?: number;
  completionTokens?: number;
  costUsd?: number;
  latencyMs?: number;
}

export interface AgentState {
  name: string;
  role: AgentRole;
  label: string;
  source?: SourceKind; // for investigators: which evidence source they are scoped to
  phase: AgentPhase;
  policy: PolicyChip;
  message?: string;
  query?: string; // the task this agent was given
  thinking?: string; // model reasoning (chain-of-thought), captured separately
  result?: string; // the agent's finding / output
  steps: Step[]; // the step-by-step path
  metrics?: AgentMetrics;
  spawn?: SpawnInfo;
}

export type RunStatus =
  | "starting"
  | "triage"
  | "investigating"
  | "awaiting-approval" // human gate: approve findings / redirect an investigator
  | "synthesizing"
  | "sending"
  | "sent"
  | "rejected"
  | "cancelled"
  | "error";

export interface Run {
  id: string;
  traceId?: string; // OpenTelemetry trace id (deep-links into Grafana/Tempo)
  incidentId: string;
  title: string; // incident title
  symptoms: string;
  posture: PolicyPosture; // current fleet posture (investigators)
  autopilot?: boolean; // hands-off: auto-approve gates + auto-remediate
  status: RunStatus;
  gate?: "findings" | "runbook"; // which human gate the run is waiting at (when awaiting-approval)
  live?: boolean; // real incident (evidence pulled live) vs scripted
  remediation?: { description: string; applied: boolean; note?: string; prUrl?: string; diff?: { key: string; before: string; after: string }[]; options?: { id: string; label: string; description: string }[] }; // real config fix the operator can apply
  agents: AgentState[];
  egress: EgressEvent[];
  policyAudit: PolicyChange[];
  report?: string; // the RCA + runbook (Markdown)
  error?: string;
  createdAt: string;
}

/** Server-sent event payload. */
export type RunEvent =
  | { type: "run"; run: Run }
  | { type: "agent"; agent: AgentState }
  | { type: "step"; agent: string; step: Step }
  | { type: "egress"; event: EgressEvent }
  | { type: "policy"; change: PolicyChange }
  | { type: "report"; markdown: string }
  | { type: "status"; status: RunStatus }
  | { type: "error"; message: string };
