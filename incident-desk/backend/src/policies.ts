import type { GatewayClient } from "./gateway.js";
import type { AgentRole, PolicyChip, PolicyPosture, SourceKind } from "./types.js";

// For a LIVE incident, each investigator is AUTHORIZED to read one internal system (its evidence
// source) — the realistic policy: internal DB/observability allowed, external internet default-deny.
// (Reads are brokered by the backend since the sandbox proxy can't reach in-cluster hosts.)
const SYSTEM: Record<SourceKind, string[]> = {
  logs: ["loki.monitoring.svc.cluster.local:3100"],
  metrics: ["prometheus.monitoring.svc.cluster.local:9090"],
  traces: ["tempo.monitoring.svc.cluster.local:3200"],
  changes: ["kubernetes.default.svc:443", "postgres.demo-shop.svc.cluster.local:5432"],
};

// Investigator evidence is injected (authorized in-band). The EGRESS policy governs EXTERNAL
// enrichment: a vendor-advisory host on the gateway's allowlist, reachable only when the posture
// permits it. This is the host the live hot-reload toggles.
export const ADVISORY_HOST = process.env.ADVISORY_HOST ?? "www.nvidia.com:443";
export const MAIL_HOST = process.env.MAIL_HOST ?? "mailpit.research-desk.svc.cluster.local";
export const MAIL_PORT = Number(process.env.MAIL_PORT ?? 1025);

export const SOURCES = ["logs", "metrics", "traces", "changes"] as const;

/** The actual L7-proxy egress rules applied for this agent (also used for the UI chip + audit). */
export function policyRules(role: AgentRole, opts: { posture?: PolicyPosture; custom?: string[]; source?: SourceKind; live?: boolean } = {}): string[] {
  if (role === "sender") {
    return [`ALLOW  ${MAIL_HOST}:${MAIL_PORT}  (read-write, enforce)`, "DENY   * everything else (default-deny)"];
  }
  if (role === "investigator") {
    const posture = opts.posture ?? "strict";
    if (posture === "custom" && opts.custom?.length) {
      return [...opts.custom.map((r) => `ALLOW  ${r}`), "ALLOW  inference.local  (model calls)", "DENY   * everything else (default-deny)"];
    }
    // internal systems this investigator is authorized to read (live incidents)
    const internal = opts.live && opts.source ? (SYSTEM[opts.source] ?? []).map((h) => `ALLOW  ${h}  (internal ${opts.source}, read-only)`) : [];
    const advisory = posture === "strict"
      ? "DENY   vendor-advisory (no external enrichment)"
      : `ALLOW  ${ADVISORY_HOST}:GET:/**  (vendor advisory, enrich)`;
    return [...internal, "ALLOW  inference.local  (model calls)", advisory, "DENY   * everything else (default-deny)"];
  }
  return ["ALLOW  inference.local  (model calls via gateway route)", "DENY   * all other egress (default-deny)"];
}

export function policyChip(role: AgentRole, opts: { posture?: PolicyPosture; custom?: string[]; source?: SourceKind; live?: boolean } = {}): PolicyChip {
  const rules = policyRules(role, opts);
  if (role === "sender") return { allow: ["mailpit (SMTP)"], deny: "everything else", rules };
  if (role === "investigator") {
    const posture = opts.posture ?? "strict";
    const internal = opts.live && opts.source ? [`internal ${opts.source}`] : [];
    const allow = posture === "strict" ? [...internal, "inference"]
      : posture === "custom" ? ["custom rules", "inference"]
        : [...internal, "+ vendor advisory", "inference"];
    return { posture, allow, deny: posture === "strict" ? "external internet" : "everything else", rules };
  }
  return { allow: ["inference.local"], deny: "all egress", rules };
}

/**
 * Apply / hot-reload an investigator's egress posture on a LIVE sandbox.
 *   strict   → inference only (advisory removed)
 *   balanced/open → adds the vendor-advisory host (enrichment allowed)
 *   custom   → operator-supplied allow rules
 */
export async function applyInvestigatorPolicy(gw: GatewayClient, name: string, posture: PolicyPosture, custom?: string[]): Promise<void> {
  // reset the advisory endpoint each time so tighten/loosen both land a clean state
  try { await gw.policyRemoveEndpoint(name, ADVISORY_HOST); } catch { /* nothing to remove */ }
  if (posture === "custom" && custom?.length) {
    // each custom rule is host:port:METHOD:path — derive endpoints from the hosts
    const eps = [...new Set(custom.map((r) => r.split(":").slice(0, 2).join(":")))];
    for (const ep of eps) { try { await gw.policyUpdate(name, { addEndpoint: `${ep}:read-only:rest:enforce`, addAllow: custom.filter((r) => r.startsWith(ep)) }); } catch { /* tolerate */ } }
    return;
  }
  if (posture !== "strict") {
    await gw.policyUpdate(name, { addEndpoint: `${ADVISORY_HOST}:read-only:rest:enforce`, addAllow: [`${ADVISORY_HOST}:GET:/**`] });
  }
  // strict: nothing added — inference.local (gateway-provided) remains the only egress
}

export async function applyRolePolicy(gw: GatewayClient, name: string, role: AgentRole): Promise<void> {
  if (role === "sender") await gw.policyAddEndpoint(name, `${MAIL_HOST}:${MAIL_PORT}:read-write:rest:enforce`);
}
