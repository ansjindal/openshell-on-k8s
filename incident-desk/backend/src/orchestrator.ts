import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { trace, context, SpanStatusCode, type Span, type Context } from "@opentelemetry/api";
import { tracer } from "./tracing.js";
import type { GatewayClient } from "./gateway.js";
import { applyInvestigatorPolicy, applyRolePolicy, policyChip, policyRules } from "./policies.js";
import { buildTriageScript, buildInvestigatorScript, buildSynthScript } from "./prompts.js";
import { getIncident, getSource, listIncidents } from "./incidents.js";
import { liveEvidenceFor, appHealth } from "./liveEvidence.js";
import { getConfigMap, patchConfigMap, restartDeployment } from "./k8s.js";
import { openMultiFilePR, commitToMain, readMainFile, mergePR } from "./github.js";
import { sendReport } from "./mailer.js";
import type {
  AgentMetrics, AgentRole, AgentState, EgressEvent, PolicyChange, PolicyPosture, Run, RunEvent, SourceKind, Step,
} from "./types.js";

export interface RunInput { incidentId: string; posture?: PolicyPosture; autopilot?: boolean; }

/** Parse a KEY=VALUE env file (for the GitOps config diff). */
function parseEnv(s: string): Record<string, string> {
  const o: Record<string, string> = {};
  for (const line of s.split("\n")) { const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/); if (m) o[m[1]] = m[2]; }
  return o;
}

type Emit = (e: RunEvent) => void;
const PRICE_PER_1K = Number(process.env.MODEL_PRICE_PER_1K_USD ?? 0.002);

const reusePool = (process.env.REUSE_SANDBOXES ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const isReused = (name: string) => reusePool.includes(name);

function spawnInfo(name: string) {
  const provider = process.env.SANDBOX_PROVIDER ?? "fleet";
  return {
    provider,
    image: process.env.SANDBOX_IMAGE ?? "ghcr.io/nvidia/openshell-community/sandboxes/openclaw:latest",
    runtime: "gVisor (runsc)",
    kind: "agents.x-k8s.io/v1alpha1 · Sandbox",
    createCmd: isReused(name) ? `reused (pre-warmed): ${name}` : `openshell sandbox create --name ${name} --provider ${provider}`,
    inference: "https://inference.local → gateway privacy router (injects creds) → LiteLLM",
    reused: isReused(name),
  };
}

interface Parsed {
  egress: { decision: "allow" | "deny"; host: string; url?: string; binary?: string; method?: string; detail?: string }[];
  usage: { prompt?: number; completion?: number; total?: number };
  timeSec?: number;
  thinking: string;
  result: string;
}
function hostOf(u: string): string { try { return new URL(u).host; } catch { return u; } }
function parseSections(stdout: string): Parsed {
  const egress: Parsed["egress"] = [];
  let usage: Parsed["usage"] = {}, timeSec: number | undefined, thinking = "", result = "";
  let mode: "none" | "egress" | "usage" | "thinking" | "result" = "none";
  for (const line of stdout.split("\n")) {
    if (line.includes("=== EGRESS ===")) { mode = "egress"; continue; }
    if (line.includes("=== USAGE ===")) { mode = "usage"; continue; }
    if (line.includes("=== THINKING ===")) { mode = "thinking"; continue; }
    if (line.includes("=== RESULT ===")) { mode = "result"; continue; }
    if (mode === "egress") {
      const m = line.match(/^(ALLOW|DENY)\s+(\S+)(?:\s+(\S+)\s+(\S+)\s*(.*))?$/);
      if (m) egress.push({ decision: m[1] === "ALLOW" ? "allow" : "deny", host: hostOf(m[2]), url: m[2], binary: m[3], method: m[4], detail: m[5] || undefined });
    } else if (mode === "usage") {
      const t = line.match(/^TIME\s+([\d.]+)/);
      if (t) timeSec = Number(t[1]);
      else { try { const u = JSON.parse(line.trim()); if (u && typeof u === "object") usage = u; } catch { /* skip */ } }
    } else if (mode === "thinking") thinking += line + "\n";
    else if (mode === "result") result += line + "\n";
  }
  return { egress, usage, timeSec, thinking: thinking.trim(), result: result.trim() };
}
function metricsOf(p: Parsed): AgentMetrics {
  const total = p.usage.total ?? (((p.usage.prompt ?? 0) + (p.usage.completion ?? 0)) || undefined);
  return { tokens: total, promptTokens: p.usage.prompt, completionTokens: p.usage.completion,
    costUsd: total != null ? Number(((total / 1000) * PRICE_PER_1K).toFixed(5)) : undefined,
    latencyMs: p.timeSec != null ? Math.round(p.timeSec * 1000) : undefined };
}

export class Orchestrator {
  private runs = new Map<string, Run>();
  private emitters = new Map<string, Set<Emit>>();
  private cancelled = new Set<string>();
  private poolIdx = new Map<string, number>();
  private stepSeq = new Map<string, number>();
  private spans = new Map<string, { root: Span; ctx: Context; agents: Map<string, Span> }>();
  private dataFile = process.env.DATA_DIR ? `${process.env.DATA_DIR}/runs.json` : null;
  private saveTimer: NodeJS.Timeout | null = null;
  private autopilotOn = false;
  private activeIncidents = new Set<string>();   // incidents with a live run (avoid duplicate autopilot runs)
  private cooldown = new Map<string, number>();   // incidentId → epoch ms until which autopilot won't re-trigger
  constructor(private gw: GatewayClient) { this.load(); setInterval(() => this.watchTick().catch(() => {}), 12_000); }

  // ── autopilot: a background watcher that auto-runs the fleet on detected incidents ──
  setAutopilot(on: boolean) { this.autopilotOn = on; }
  getAutopilot() { return this.autopilotOn; }
  private async watchTick() {
    if (!this.autopilotOn) return;
    for (const inc of listIncidents().filter((i) => i.live)) {
      if (this.activeIncidents.has(inc.id) || Date.now() < (this.cooldown.get(inc.id) ?? 0)) continue;
      const cfg = getIncident(inc.id)?.liveConfig;
      if (!cfg) continue;
      try { if ((await appHealth(cfg)).status === "issue") this.start({ incidentId: inc.id, autopilot: true }); } catch { /* skip */ }
    }
  }

  // ── run history persistence (PVC-backed JSON; survives backend restarts) ──
  private load() {
    if (!this.dataFile) return;
    try {
      const arr = JSON.parse(readFileSync(this.dataFile, "utf8")) as Run[];
      for (const r of arr) { if (!["triage", "investigating", "synthesizing", "sending", "starting"].includes(r.status)) this.runs.set(r.id, r); else { r.status = "error"; r.error = "interrupted by a backend restart"; this.runs.set(r.id, r); } }
    } catch { /* no prior history */ }
  }
  private saveSoon() {
    if (!this.dataFile || this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      try { writeFileSync(this.dataFile!, JSON.stringify([...this.runs.values()].slice(-60))); } catch { /* ignore */ }
    }, 1000);
  }
  listRuns(): Array<{ id: string; incidentId: string; title: string; status: string; gate?: string; live?: boolean; createdAt: string }> {
    return [...this.runs.values()].map((r) => ({ id: r.id, incidentId: r.incidentId, title: r.title, status: r.status, gate: r.gate, live: r.live, createdAt: r.createdAt }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  // ── tracing helpers ──
  private agentSpan(run: Run, name: string): Span | undefined {
    const t = this.spans.get(run.id); if (!t) return undefined;
    let s = t.agents.get(name);
    if (!s) {
      const a = run.agents.find((x) => x.name === name);
      s = tracer.startSpan(`agent.${a?.role ?? "?"}${a?.source ? "." + a.source : ""}`,
        { attributes: { "agent.name": name, "agent.role": a?.role ?? "", "agent.source": a?.source ?? "" } }, t.ctx);
      t.agents.set(name, s);
    }
    return s;
  }
  private endAgentSpan(run: Run, name: string, ok: boolean, msg?: string) {
    const s = this.spans.get(run.id)?.agents.get(name);
    if (!s) return;
    s.setStatus({ code: ok ? SpanStatusCode.OK : SpanStatusCode.ERROR, message: msg });
    s.end();
  }
  private endTrace(run: Run, status: string) {
    const t = this.spans.get(run.id); if (!t) return;
    for (const s of t.agents.values()) s.end();
    t.root.setAttribute("run.status", status);
    t.root.setStatus({ code: status === "sent" ? SpanStatusCode.OK : SpanStatusCode.ERROR });
    t.root.end();
    this.spans.delete(run.id);
  }

  get(id: string): Run | undefined { return this.runs.get(id); }
  logs(name: string): Promise<string> { return this.gw.logs(name); }
  policy(name: string): Promise<string> { return this.gw.policyGet(name); }
  policyHistory(name: string): Promise<string> { return this.gw.policyList(name); }

  subscribe(id: string, emit: Emit): () => void {
    let set = this.emitters.get(id);
    if (!set) { set = new Set(); this.emitters.set(id, set); }
    set.add(emit);
    const run = this.runs.get(id);
    if (run) emit({ type: "run", run });
    return () => set!.delete(emit);
  }
  private emit(id: string, e: RunEvent) { for (const fn of this.emitters.get(id) ?? []) fn(e); this.saveSoon(); }

  private setAgent(run: Run, name: string, patch: Partial<AgentState>) {
    const a = run.agents.find((x) => x.name === name);
    if (!a) return;
    Object.assign(a, patch);
    if (patch.phase === "done" || patch.phase === "error") this.endAgentSpan(run, name, patch.phase === "done", patch.message);
    this.emit(run.id, { type: "agent", agent: a });
  }
  private step(run: Run, name: string, kind: Step["kind"], title: string, detail?: string, ok?: boolean) {
    const a = run.agents.find((x) => x.name === name);
    if (!a) return;
    const id = (this.stepSeq.get(run.id) ?? 0) + 1; this.stepSeq.set(run.id, id);
    const s: Step = { id, ts: new Date().toISOString(), kind, title, detail, ok };
    a.steps.push(s);
    this.agentSpan(run, name)?.addEvent(title, { "step.kind": kind, "step.ok": ok ?? true, ...(detail ? { "step.detail": detail.slice(0, 500) } : {}) });
    this.emit(run.id, { type: "step", agent: name, step: s });
  }
  private addEgress(run: Run, ev: Omit<EgressEvent, "ts">) {
    const e: EgressEvent = { ...ev, ts: new Date().toISOString() };
    run.egress.push(e);
    this.emit(run.id, { type: "egress", event: e });
  }
  private audit(run: Run, c: Omit<PolicyChange, "ts">) {
    const change: PolicyChange = { ...c, ts: new Date().toISOString() };
    run.policyAudit.push(change);
    this.emit(run.id, { type: "policy", change });
  }
  private setStatus(run: Run, status: Run["status"], gate?: Run["gate"]) {
    run.status = status; run.gate = gate;
    if (["sent", "rejected", "cancelled", "error"].includes(status)) {
      this.endTrace(run, status);
      this.activeIncidents.delete(run.incidentId);
      this.cooldown.set(run.incidentId, Date.now() + 120_000); // let recovery settle before re-detecting
    }
    this.emit(run.id, { type: "status", status });
    this.emit(run.id, { type: "run", run });
    // autopilot: auto-advance the human gates (with a short delay so the flow is watchable)
    if (run.autopilot && status === "awaiting-approval") {
      if (gate === "findings") setTimeout(() => this.approve(run.id).catch(() => {}), 4000);
      else if (gate === "runbook") setTimeout(() => this.remediate(run.id).then(() => this.approve(run.id)).catch(() => {}), 4000);
    }
  }

  private addAgent(run: Run, role: AgentRole, label: string, opts: { source?: SourceKind; query: string }): AgentState {
    const i = this.poolIdx.get(run.id) ?? 0;
    this.poolIdx.set(run.id, i + 1);
    const name = i < reusePool.length ? reusePool[i] : `rd-${run.id}-${role}-${i}`;
    const a: AgentState = {
      name, role, label, source: opts.source, phase: "pending",
      policy: policyChip(role, { posture: run.posture, source: opts.source, live: run.live }),
      query: opts.query, steps: [],
    };
    run.agents.push(a);
    this.emit(run.id, { type: "run", run });
    return a;
  }

  /** Start an RCA run for an incident. */
  start(input: RunInput): Run {
    const incident = getIncident(input.incidentId);
    if (!incident) throw new Error(`unknown incident: ${input.incidentId}`);
    const id = randomUUID().slice(0, 8);
    const posture: PolicyPosture = input.posture ?? "strict";
    const run: Run = {
      id, incidentId: incident.id, title: incident.title, symptoms: incident.symptoms,
      posture, status: "starting", agents: [], egress: [], policyAudit: [], createdAt: new Date().toISOString(),
      live: incident.live, autopilot: input.autopilot,
      remediation: incident.remediation ? {
        description: incident.remediation.description, applied: false,
        options: incident.remediation.kind === "gitops" ? incident.remediation.options.map((o) => ({ id: o.id, label: o.label, description: o.description })) : undefined,
      } : undefined,
    };
    this.runs.set(id, run);
    this.activeIncidents.add(incident.id);
    const root = tracer.startSpan("rca.run", { attributes: { "incident.id": incident.id, "incident.title": incident.title, "run.posture": posture, "run.id": id } });
    run.traceId = root.spanContext().traceId;
    this.spans.set(id, { root, ctx: trace.setSpan(context.active(), root), agents: new Map() });
    this.addAgent(run, "coordinator", "triage", { query: `Triage the incident and form one hypothesis per evidence source.` });
    setImmediate(() => this.execute(run).catch((err) => {
      run.error = String(err?.message ?? err);
      this.setStatus(run, "error");
      this.emit(id, { type: "error", message: run.error });
    }));
    return run;
  }

  private async create(run: Run, a: AgentState) {
    this.setAgent(run, a.name, { spawn: spawnInfo(a.name) });
    if (!isReused(a.name)) {
      this.setAgent(run, a.name, { phase: "creating" });
      this.step(run, a.name, "note", "Creating sandbox", a.name);
      await this.gw.createSandbox(a.name);
      await this.gw.waitReady(a.name);
    }
    this.setAgent(run, a.name, { phase: "policy" });
    if (a.role === "investigator" && a.source) {
      await applyInvestigatorPolicy(this.gw, a.name, run.posture);
      await this.gw.policyWaitEffective(a.name).catch(() => {});
      const rules = policyRules("investigator", { posture: run.posture, source: a.source, live: run.live });
      this.step(run, a.name, "policy", `Authorized for ${a.source} · egress ${run.posture}`, rules.join("\n"), true);
      this.audit(run, { agent: a.name, posture: run.posture, rules, by: "system", note: "initial scope" });
    } else {
      await applyRolePolicy(this.gw, a.name, a.role);
      this.step(run, a.name, "policy", a.role === "sender" ? "Scoped to mail only" : "Default-deny (inference only)", policyRules(a.role).join("\n"), true);
    }
  }

  private absorb(run: Run, a: AgentState, parsed: Parsed) {
    for (const e of parsed.egress) {
      this.addEgress(run, { agent: a.name, ...e });
      if (e.host !== "inference.local") {
        this.step(run, a.name, "egress", `${e.decision === "allow" ? "Reached" : "Blocked"} ${e.host}`, `${e.method ?? "GET"} ${e.url ?? e.host} → ${e.detail ?? ""}`, e.decision === "allow");
      }
    }
    const m = metricsOf(parsed);
    this.setAgent(run, a.name, { metrics: m });
    if (parsed.thinking) this.setAgent(run, a.name, { thinking: parsed.thinking });
    this.step(run, a.name, "infer", "Queried model", `${m.tokens ?? "?"} tokens · ${m.latencyMs ?? "?"}ms`, true);
  }

  private async execute(run: Run) {
    const stop = () => this.cancelled.has(run.id);
    const incident = getIncident(run.incidentId)!;
    const coord = run.agents.find((a) => a.role === "coordinator")!;

    // 1) Triage
    this.setStatus(run, "triage");
    await this.create(run, coord);
    if (stop()) return;
    this.setAgent(run, coord.name, { phase: "running", message: "forming hypotheses…" });
    this.step(run, coord.name, "plan", "Reading symptoms, forming hypotheses");
    const tr = parseSections((await this.gw.execScript(coord.name, buildTriageScript(incident.symptoms, incident.sources.map((s) => s.kind)), { timeoutSec: 600 })).stdout);
    this.absorb(run, coord, tr);
    let plan = this.parsePlan(tr.result, incident.sources.map((s) => s.kind));
    this.setAgent(run, coord.name, { phase: "done", message: `assigned ${plan.length} investigators: ${plan.map((p) => p.source).join(", ")}` });
    this.step(run, coord.name, "finding", `Assigned ${plan.length} investigators`, plan.map((p) => `${p.source}: ${p.hypothesis}`).join("\n"));
    if (stop()) return;

    // 2) Investigate (parallel, each scoped to one source)
    this.setStatus(run, "investigating");
    const investigators = plan.map((p) => this.addAgent(run, "investigator", `${p.source} investigator`, {
      source: p.source, query: `Hypothesis: ${p.hypothesis}`,
    }));
    // Sequential, not Promise.all: the upstream NIM rate-limits CONCURRENT requests, so firing
    // all investigators at once made the 3rd/4th (traces/changes) come back empty ("? tok").
    // One at a time → each model call runs alone → reliable findings. (INFERENCE_PARALLEL=1 by
    // default; set >1 only if your endpoint tolerates concurrency.)
    const conc = Math.max(1, parseInt(process.env.INFERENCE_PARALLEL || "1", 10));
    for (let i = 0; i < investigators.length; i += conc) {
      await Promise.all(investigators.slice(i, i + conc).map(async (w, j) => {
        try { await this.runInvestigator(run, w, plan[i + j].hypothesis); }
        catch (err) { this.setAgent(run, w.name, { phase: "error", message: String((err as Error).message) }); }
      }));
      if (stop()) return;
    }
    if (stop()) return;

    // 3) Human gate: review findings (approve → synthesize, or redirect/hot-reload then re-run)
    this.setStatus(run, "awaiting-approval", "findings");
  }

  private async runInvestigator(run: Run, w: AgentState, hypothesis: string, opts: { applyPolicy?: boolean } = {}) {
    // initial run: create + apply scoped policy. redirect re-run: keep the live (possibly
    // hot-reloaded) policy — re-applying would clobber an operator's mid-run posture change.
    if (opts.applyPolicy !== false) await this.create(run, w);
    this.setAgent(run, w.name, { phase: "running", message: `investigating ${w.source}` });
    const incident = getIncident(run.incidentId)!;
    const evidence = incident.live && incident.liveConfig ? await liveEvidenceFor(w.source!, incident.liveConfig) : (getSource(run.incidentId, w.source!)?.body ?? "(no evidence)");
    this.step(run, w.name, incident.live ? "fetch" : "note", incident.live ? `Pulled live ${w.source} (${w.source === "logs" ? "Loki" : w.source === "metrics" ? "Prometheus" : w.source === "traces" ? "Tempo" : "Kubernetes"})` : `Loaded ${w.source} evidence (authorized in-band)`, evidence.slice(0, 400), true);
    const parsed = parseSections((await this.gw.execScript(w.name, buildInvestigatorScript(w.source!, hypothesis, evidence), { timeoutSec: 600 })).stdout);
    this.absorb(run, w, parsed);
    const result = parsed.result || "(no finding)";
    this.setAgent(run, w.name, { phase: "done", result, message: "finding ready" });
    this.step(run, w.name, "finding", "Reported finding", result.slice(0, 400));
  }

  /** Human action: re-task / re-run a single investigator (e.g. after a policy hot-reload). */
  async redirect(id: string, agentName: string, hypothesis?: string): Promise<void> {
    const run = this.runs.get(id);
    if (!run) throw new Error("run not found");
    const w = run.agents.find((a) => a.name === agentName && a.role === "investigator");
    if (!w) throw new Error("investigator not found");
    const hyp = hypothesis?.trim() || (w.query || "").replace(/^Hypothesis:\s*/, "");
    if (hypothesis?.trim()) this.setAgent(run, w.name, { query: `Hypothesis: ${hyp}` });
    this.step(run, w.name, "redirect", "Re-tasked by operator", hyp);
    this.setStatus(run, "investigating", undefined);
    try { await this.runInvestigator(run, w, hyp, { applyPolicy: false }); }
    catch (err) { this.setAgent(run, w.name, { phase: "error", message: String((err as Error).message) }); }
    this.setStatus(run, "awaiting-approval", "findings");
  }

  /** Human action: hot-reload an investigator's egress policy on the LIVE sandbox. */
  async setPosture(id: string, target: string, posture: PolicyPosture, custom?: string[]): Promise<void> {
    const run = this.runs.get(id);
    if (!run) throw new Error("run not found");
    const targets = target === "all"
      ? run.agents.filter((a) => a.role === "investigator")
      : run.agents.filter((a) => a.name === target && a.role === "investigator");
    if (!targets.length) throw new Error("no investigator target");
    if (target === "all") run.posture = posture;
    for (const w of targets) {
      await applyInvestigatorPolicy(this.gw, w.name, posture, custom);
      await this.gw.policyWaitEffective(w.name).catch(() => {});
      const rules = policyRules("investigator", { posture, custom, source: w.source, live: run.live });
      this.setAgent(run, w.name, { policy: policyChip("investigator", { posture, custom, source: w.source, live: run.live }) });
      this.step(run, w.name, "policy", `Policy hot-reloaded → ${posture}`, rules.join("\n"), true);
      this.audit(run, { agent: w.name, posture, rules, by: "operator", note: "live hot-reload" });
    }
    this.emit(run.id, { type: "run", run });
  }

  /** Human approval — advances based on which gate the run is at. */
  async approve(id: string): Promise<void> {
    const run = this.runs.get(id);
    if (!run || run.status !== "awaiting-approval") throw new Error("run not awaiting approval");
    if (run.gate === "findings") return this.synthesize(run);
    if (run.gate === "runbook") return this.send(run);
    throw new Error("nothing to approve");
  }

  private async synthesize(run: Run) {
    const incident = getIncident(run.incidentId)!;
    const findings = run.agents.filter((a) => a.role === "investigator" && a.result)
      .map((a) => ({ source: a.source as string, summary: a.result! }));
    this.setStatus(run, "synthesizing");
    const synth = this.addAgent(run, "synthesizer", "root cause + runbook", { query: `Correlate ${findings.length} findings into an RCA + remediation runbook.` });
    await this.create(run, synth);
    this.setAgent(run, synth.name, { phase: "running", message: "correlating findings…" });
    this.step(run, synth.name, "plan", "Correlating findings across sources");
    const badReport = (s: string) => !s.trim() || /TASK_(ERROR|PARSE_ERROR)/.test(s) || !s.includes("#");
    let md = "";
    for (let attempt = 1; attempt <= 2; attempt++) {
      const parsed = parseSections((await this.gw.execScript(synth.name, buildSynthScript(incident.title, incident.symptoms, findings), { timeoutSec: 600 })).stdout);
      this.absorb(run, synth, parsed);
      md = parsed.result;
      if (!badReport(md)) break;
      if (attempt < 2) this.setAgent(run, synth.name, { message: "report empty — retrying…" });
    }
    if (badReport(md)) md = `# Incident RCA — ${run.title}\n\n${md.trim() || "(report unavailable — model returned no content)"}`;
    run.report = md;
    this.setAgent(run, synth.name, { phase: "done", message: "RCA + runbook ready" });
    this.step(run, synth.name, "finding", "RCA + runbook ready");
    this.emit(run.id, { type: "report", markdown: md });
    // compute the remediation config diff (current vs proposed) for the UI
    if (run.remediation && incident.remediation) {
      const rem = incident.remediation;
      try {
        if (rem.kind === "configmap") {
          const cm = await getConfigMap(rem.namespace, rem.configMap);
          run.remediation.diff = Object.entries(rem.set).map(([k, v]) => ({ key: k, before: String(cm?.data?.[k] ?? "(unset)"), after: v }));
        } else {
          const cur = parseEnv(await readMainFile(rem.gitFile)), good = parseEnv(rem.goodContent);
          run.remediation.diff = Object.keys(good).filter((k) => cur[k] !== good[k]).map((k) => ({ key: k, before: cur[k] ?? "(unset)", after: good[k] }));
        }
      } catch { /* read failed — skip diff */ }
    }
    // sender appears, waiting on the runbook approval gate
    const sender = this.addAgent(run, "sender", "deliver runbook", { query: "Email the approved runbook to on-call." });
    await this.create(run, sender);
    this.setAgent(run, sender.name, { phase: "blocked", message: "scoped to mail — awaiting approval" });
    this.setStatus(run, "awaiting-approval", "runbook");
  }

  private async send(run: Run) {
    const sender = run.agents.find((a) => a.role === "sender")!;
    this.setStatus(run, "sending");
    this.setAgent(run, sender.name, { phase: "running", message: "sending runbook" });
    const mailHost = process.env.MAIL_HOST ?? "mailpit";
    const mailPort = process.env.MAIL_PORT ?? "1025";
    this.addEgress(run, { agent: sender.name, decision: "allow", host: mailHost, url: `smtp://${mailHost}:${mailPort}`, binary: "nodemailer", method: "SMTP", detail: "runbook delivery" });
    this.step(run, sender.name, "egress", `Reached ${mailHost}`, "SMTP runbook delivery", true);
    const msgId = await sendReport({ subject: `Incident RCA — ${run.title}`, html: run.report ?? "" });
    this.setAgent(run, sender.name, { phase: "done", message: `sent (${msgId})` });
    this.step(run, sender.name, "note", "Runbook delivered", msgId);
    this.setStatus(run, "sent");
  }

  /** Re-trigger a live incident: re-inject the fault (ConfigMap patch or a bad Git commit). */
  async triggerIncident(incidentId: string): Promise<{ ok: true }> {
    const rem = getIncident(incidentId)?.remediation;
    if (!rem) throw new Error("no remediation/fault knob for this incident");
    if (rem.kind === "configmap") {
      await patchConfigMap(rem.namespace, rem.configMap, { [rem.fault.key]: rem.fault.value });
      await restartDeployment(rem.namespace, rem.restart);
    } else {
      await commitToMain(rem.gitFile, rem.faultContent, "chore(orders): cost-tuning — lower cache+pool (regression)");
    }
    return { ok: true };
  }

  /** Human-approved real remediation: ConfigMap patch+roll, OR open a fix PR (GitOps; optionId picks the fix). */
  async remediate(id: string, optionId?: string): Promise<void> {
    const run = this.runs.get(id);
    if (!run) throw new Error("run not found");
    const rem = getIncident(run.incidentId)?.remediation;
    if (!rem || !run.remediation) throw new Error("no remediation available for this incident");
    const stepOn = run.agents.find((a) => a.role === "sender")?.name;
    if (rem.kind === "configmap") {
      const sets = Object.entries(rem.set).map(([k, v]) => `${k}=${v}`).join(", ");
      if (stepOn) this.step(run, stepOn, "redirect", `Applying remediation → ${rem.configMap} {${sets}}`, rem.description);
      await patchConfigMap(rem.namespace, rem.configMap, rem.set);
      await restartDeployment(rem.namespace, rem.restart);
      run.remediation.applied = true;
      run.remediation.note = `Patched ${rem.namespace}/${rem.configMap} {${sets}} and rolled ${rem.restart}. Watch metrics recover.`;
      if (stepOn) this.step(run, stepOn, "finding", "Remediation applied to live cluster", run.remediation.note, true);
    } else {
      const opt = rem.options.find((o) => o.id === optionId) ?? rem.options[0];
      if (stepOn) this.step(run, stepOn, "redirect", `Opening fix PR — ${opt.label}`, opt.description);
      // unique branch per run so we never reuse a stale branch (→ empty diff)
      const pr = await openMultiFilePR(`${opt.branch}-${run.id}`, opt.title, opt.body, opt.edits);
      run.remediation.applied = true;
      run.remediation.prUrl = pr.url;
      if (run.autopilot) {
        try { await mergePR(pr.number); run.remediation.note = `Autopilot opened + merged PR #${pr.number} (${opt.label}). ArgoCD syncs the fix — catalog-api recovers.`; if (stepOn) this.step(run, stepOn, "finding", `Auto-merged fix PR #${pr.number} — ${opt.label}`, pr.url, true); }
        catch (e) { run.remediation.note = `Opened PR #${pr.number} (${opt.label}); auto-merge failed (${String(e).slice(0, 80)}) — merge manually.`; }
      } else {
        run.remediation.note = `Opened PR #${pr.number} (${opt.label}). Review & merge it on GitHub — ArgoCD then syncs and catalog-api recovers.`;
        if (stepOn) this.step(run, stepOn, "finding", `Opened fix PR #${pr.number} — ${opt.label}`, pr.url, true);
      }
    }
    this.emit(run.id, { type: "run", run });
  }

  reject(id: string) { const run = this.runs.get(id); if (run) this.setStatus(run, "rejected"); }

  async cancel(id: string): Promise<void> {
    const run = this.runs.get(id);
    if (!run) return;
    this.cancelled.add(id);
    this.setStatus(run, "cancelled");
    await this.teardown(id);
  }
  async teardown(id: string): Promise<void> {
    const run = this.runs.get(id);
    if (!run) return;
    await Promise.all(run.agents.filter((a) => !isReused(a.name)).map((a) => this.gw.deleteSandbox(a.name).catch(() => {})));
  }

  private parsePlan(result: string, sources: SourceKind[]): { source: SourceKind; hypothesis: string }[] {
    try {
      const json = result.slice(result.indexOf("["), result.lastIndexOf("]") + 1);
      const arr = JSON.parse(json) as { source?: string; hypothesis?: string }[];
      const plan = arr.filter((x) => x && x.source && sources.includes(x.source as SourceKind))
        .map((x) => ({ source: x.source as SourceKind, hypothesis: x.hypothesis || `Investigate the ${x.source} evidence.` }));
      // de-dup by source, keep order of `sources`
      const seen = new Set<string>();
      const ordered = sources.map((s) => plan.find((p) => p.source === s && !seen.has(s) && (seen.add(s), true))).filter(Boolean) as { source: SourceKind; hypothesis: string }[];
      if (ordered.length) return ordered;
    } catch { /* fall through */ }
    return sources.map((s) => ({ source: s, hypothesis: `Investigate the ${s} evidence for the incident.` }));
  }
}
