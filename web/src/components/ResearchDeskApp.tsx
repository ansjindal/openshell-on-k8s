"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { marked } from "marked";
import {
  Activity, AlertTriangle, ArrowUpRight, Brain, CheckCircle2, Circle, Clock, Compass, Coins, Cpu,
  Database, ExternalLink, Eye, FileText, GitMerge, History, Inbox, LineChart, Network, Play,
  RotateCw, ScrollText, Search, Send, Shield, ShieldCheck, Workflow, X, XCircle, Zap, BarChart3, Gauge,
} from "lucide-react";
import {
  appHealth, approve, cancelRun, getAutopilot, getIncident, getIncidents, getLogs, getPods, getPolicy, getPolicyHistory, getRun, hotReloadPolicy,
  listRuns, litellmSummary, redirectAgent, reject, remediateRun, setAutopilotApi, startRun, streamRun, telemetryConfig, triggerIncident,
  type AgentRole, type AgentState, type AppHealth, type Incident, type IncidentDetail,
  type LiteLLMSummary, type PodInfo, type PolicyPosture, type Run, type RunSummary, type SourceKind, type Step, type TelemetryConfig,
} from "@/lib/researchDeskApi";

type Tab = "info" | "steps" | "think" | "policy" | "logs";
type Deck = "timeline" | "egress" | "cost" | "dash";
const I = (C: any, size = 14) => <C size={size} strokeWidth={2} />;

const ROLE: Record<string, { color: string; stage: string; Icon: any }> = {
  coordinator: { color: "#f59e0b", stage: "Triage", Icon: Compass },
  investigator: { color: "#7c6fff", stage: "Investigate · parallel", Icon: Search },
  synthesizer: { color: "#a78bfa", stage: "Correlate", Icon: GitMerge },
  sender: { color: "#06d6a0", stage: "Deliver", Icon: Send },
};
const SRC: Record<SourceKind, any> = { logs: ScrollText, metrics: LineChart, traces: Network, changes: History };
const STEPI: Record<Step["kind"], any> = {
  plan: Compass, policy: Shield, fetch: Database, egress: ArrowUpRight, infer: Cpu, think: Brain,
  finding: CheckCircle2, redirect: RotateCw, note: Circle, error: XCircle,
};
const POSTURES: PolicyPosture[] = ["strict", "balanced", "open"];
function traceUrl(grafana: string, traceId: string): string {
  const left = { datasource: "tempo", queries: [{ refId: "A", queryType: "traceql", query: traceId }], range: { from: "now-1h", to: "now" } };
  return `${grafana}/explore?orgId=1&left=${encodeURIComponent(JSON.stringify(left))}`;
}
const POSTURE_DESC: Record<PolicyPosture, string> = {
  strict: "evidence + inference only — no external egress",
  balanced: "+ vendor-advisory enrichment lookup",
  open: "+ vendor-advisory enrichment lookup",
  custom: "operator-defined egress rules",
};
const FLOW = [
  { Icon: Compass, t: "Triage", d: "Coordinator reads the incident symptoms and forms one hypothesis per evidence source." },
  { Icon: Search, t: "Investigate", d: "One agent per source (logs / metrics / traces / deploys) runs in parallel, each authorized for only its source; egress is default-deny." },
  { Icon: Eye, t: "Review (you)", d: "You inspect each finding before correlation — redirect an agent or hot-reload its egress policy and re-run." },
  { Icon: GitMerge, t: "Correlate", d: "Synthesizer combines the approved findings into a root cause + remediation runbook." },
  { Icon: Send, t: "Deliver", d: "After you approve, a mail-scoped agent emails the runbook to on-call." },
];

type Vis = "queued" | "waiting" | "active" | "done" | "error";
function visState(a: AgentState, run: Run): { vis: Vis; label: string } {
  if (a.phase === "error") return { vis: "error", label: a.message || "error" };
  if (a.phase === "blocked") return { vis: "waiting", label: a.message || "awaiting approval" };
  if (a.phase === "done") {
    if (a.role === "sender" && run.status !== "sent") return { vis: "waiting", label: "awaiting approval" };
    return { vis: "done", label: a.message || "done" };
  }
  if (["creating", "policy", "running"].includes(a.phase))
    return { vis: "active", label: a.phase === "running" ? (a.message || "working…") : a.phase === "policy" ? "applying policy…" : "creating sandbox…" };
  if (a.role === "investigator") { const c = run.agents.find((x) => x.role === "coordinator"); if (c && c.phase !== "done") return { vis: "waiting", label: "waiting for triage" }; }
  if (a.role === "synthesizer") return { vis: "waiting", label: "waiting for approval" };
  if (a.role === "sender") return { vis: "waiting", label: "waiting for runbook" };
  return { vis: "queued", label: "queued" };
}

const ADVISORY = "www.nvidia.com:443:GET:/**";
// mirrors backend policies.ts: internal system per source (live incidents)
const SYSTEM: Record<SourceKind, string[]> = {
  logs: ["loki.monitoring.svc.cluster.local:3100"],
  metrics: ["prometheus.monitoring.svc.cluster.local:9090"],
  traces: ["tempo.monitoring.svc.cluster.local:3200"],
  changes: ["kubernetes.default.svc:443", "postgres.demo-shop.svc.cluster.local:5432"],
};
// mirrors backend policyRules() for investigators, so we can preview a posture's YAML client-side
function rulesForPosture(posture: PolicyPosture, custom?: string[], source?: SourceKind, live?: boolean): string[] {
  if (posture === "custom" && custom?.length) return [...custom.map((r) => `ALLOW  ${r}`), "ALLOW  inference.local  (model calls)", "DENY   * everything else (default-deny)"];
  const internal = live && source ? (SYSTEM[source] ?? []).map((h) => `ALLOW  ${h}  (internal ${source}, read-only)`) : [];
  const advisory = posture === "strict" ? "DENY   vendor-advisory (no external enrichment)" : `ALLOW  ${ADVISORY}  (vendor advisory, enrich)`;
  return [...internal, "ALLOW  inference.local  (model calls)", advisory, "DENY   * everything else (default-deny)"];
}
const MAIL = "mailpit.research-desk.svc.cluster.local:1025";
function roleRules(role: AgentRole, source: SourceKind | undefined, posture: PolicyPosture, live: boolean): string[] {
  if (role === "sender") return [`ALLOW  ${MAIL}  (read-write, enforce)`, "DENY   * everything else (default-deny)"];
  if (role === "investigator") return rulesForPosture(posture, undefined, source, live);
  return ["ALLOW  inference.local  (model calls)", "DENY   * all other egress (default-deny)"]; // coordinator / synthesizer
}
function rolePolicyYaml(role: AgentRole, source: SourceKind | undefined, posture: PolicyPosture, live: boolean): string {
  const lines = ["# egress policy (L7 proxy, enforce mode)", `role: ${role}`];
  if (source) lines.push(`evidence_source: ${source}`);
  if (role === "investigator") lines.push(`posture: ${posture}`);
  lines.push("egress:");
  for (const r of roleRules(role, source, posture, live)) {
    const m = r.match(/^(ALLOW|DENY)\s+(.*)$/);
    if (m) { lines.push(`  - action: ${m[1].toLowerCase()}`); lines.push(`    rule: "${m[2].replace(/\s+/g, " ").trim()}"`); }
    else lines.push(`  - "${r.trim()}"`);
  }
  return lines.join("\n");
}
function policyYaml(a: AgentState, posture = a.policy.posture, rules = a.policy.rules || []): string {
  const lines = ["# effective egress policy (L7 proxy, enforce mode)", `sandbox: ${a.name}`, `role: ${a.role}`];
  if (a.source) lines.push(`evidence_source: ${a.source}   # authorized in-band`);
  if (posture) lines.push(`posture: ${posture}`);
  lines.push("egress:");
  for (const r of rules) {
    const m = r.match(/^(ALLOW|DENY)\s+(.*)$/);
    if (m) { lines.push(`  - action: ${m[1].toLowerCase()}`); lines.push(`    rule: "${m[2].replace(/\s+/g, " ").trim()}"`); }
    else lines.push(`  - "${r.trim()}"`);
  }
  return lines.join("\n");
}
function YamlDiff({ from, to }: { from: string; to: string }) {
  const A = from.split("\n"), B = to.split("\n");
  const sa = new Set(A), sb = new Set(B);
  return (
    <pre className="code diff">
      {A.filter((l) => !sb.has(l)).map((l, i) => <div key={"d" + i} className="dl del">- {l}</div>)}
      {B.map((l, i) => <div key={"b" + i} className={"dl " + (sa.has(l) ? "" : "add")}>{sa.has(l) ? "  " : "+ "}{l}</div>)}
    </pre>
  );
}

export default function App() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [incidentId, setIncidentId] = useState("");
  const [detail, setDetail] = useState<IncidentDetail | null>(null);
  const [posture, setPosture] = useState<PolicyPosture>("strict");
  const [run, setRun] = useState<Run | null>(null);
  const [sel, setSel] = useState<{ name: string; tab: Tab } | null>(null);
  const [deck, setDeck] = useState<Deck>("timeline");
  const [tele, setTele] = useState<TelemetryConfig | null>(null);
  const [llm, setLlm] = useState<LiteLLMSummary | null>(null);
  // Theme is owned by the site header (SiteHeader's ThemeToggle, key "oclaw-theme")
  // so the page has ONE toggle, not two. We mirror that state for the in-app charts
  // (the Dashboards/Grafana embed needs to know dark vs light) and react to the
  // header's toggle event — we don't write the theme or render our own toggle.
  const [theme, setTheme] = useState<"dark" | "light">(() => (localStorage.getItem("oclaw-theme") as "dark" | "light") || "dark");
  useEffect(() => {
    const onTheme = (e: Event) => setTheme(((e as CustomEvent).detail as "dark" | "light") || "dark");
    window.addEventListener("oclaw:theme", onTheme);
    return () => window.removeEventListener("oclaw:theme", onTheme);
  }, []);
  const [history, setHistory] = useState<RunSummary[]>([]);
  const [showHist, setShowHist] = useState(false);
  const [autopilot, setAutopilot] = useState(false);
  useEffect(() => { getAutopilot().then((s) => setAutopilot(s.enabled)).catch(() => {}); }, []);
  const toggleAutopilot = () => { const n = !autopilot; setAutopilot(n); setAutopilotApi(n).catch(() => {}); };
  const refreshHistory = () => listRuns().then(setHistory).catch(() => {});
  const openRun = (id: string) => { setSel(null); setShowHist(false); getRun(id).then(setRun).catch(() => {}); };
  // restore the run from the URL on load (#run=<id>) + load history
  useEffect(() => { const m = location.hash.match(/run=([a-z0-9]+)/i); if (m) getRun(m[1]).then(setRun).catch(() => {}); refreshHistory(); }, []);
  // keep the URL in sync so a refresh reopens the same run
  useEffect(() => { if (run) { location.hash = `run=${run.id}`; refreshHistory(); } }, [run?.id]);
  // autopilot: when no run is open, auto-surface the fleet the watcher just started
  useEffect(() => {
    if (!autopilot || run) return;
    const t = setInterval(() => listRuns().then((rs) => { const a = rs.find((r) => !["sent", "rejected", "error", "cancelled"].includes(r.status)); if (a) openRun(a.id); }).catch(() => {}), 5000);
    return () => clearInterval(t);
  }, [autopilot, run?.id]);

  const canvasRef = useRef<HTMLDivElement>(null);
  const nodeEls = useRef<Map<string, HTMLDivElement>>(new Map());
  const [edges, setEdges] = useState<{ d: string; cls: string }[]>([]);

  useEffect(() => { getIncidents().then((i) => { setIncidents(i); setIncidentId(i[0]?.id ?? ""); }); telemetryConfig().then(setTele); }, []);
  useEffect(() => { if (incidentId) getIncident(incidentId).then(setDetail).catch(() => setDetail(null)); }, [incidentId]);

  useEffect(() => {
    if (!run) return;
    return streamRun(run.id, (e) => {
      if (e.type === "run") setRun(e.run);
      else if (e.type === "agent") setRun((r) => r && { ...r, agents: r.agents.map((x) => x.name === e.agent.name ? e.agent : x) });
      else if (e.type === "step") setRun((r) => r && { ...r, agents: r.agents.map((x) => x.name === e.agent ? { ...x, steps: [...x.steps.filter((s) => s.id !== e.step.id), e.step] } : x) });
      else if (e.type === "egress") setRun((r) => r && { ...r, egress: [...r.egress, e.event] });
      else if (e.type === "policy") setRun((r) => r && { ...r, policyAudit: [...r.policyAudit, e.change] });
      else if (e.type === "status") setRun((r) => r && { ...r, status: e.status });
      else if (e.type === "report") setRun((r) => r && { ...r, report: e.markdown });
    });
  }, [run?.id]);

  useEffect(() => {
    if (!run) return;
    const tick = () => litellmSummary().then(setLlm).catch(() => {});
    tick(); const t = setInterval(tick, 8000); return () => clearInterval(t);
  }, [run?.id]);

  useLayoutEffect(() => {
    const compute = () => {
      const c = canvasRef.current; if (!c || !run) return setEdges([]);
      const cb = c.getBoundingClientRect();
      const pt = (n: string, s: "l" | "r") => { const el = nodeEls.current.get(n); if (!el) return null; const r = el.getBoundingClientRect(); return { x: (s === "r" ? r.right : r.left) - cb.left, y: r.top - cb.top + r.height / 2 }; };
      const cls = (a?: AgentState) => !a ? "pending" : a.phase === "done" ? "done" : ["running", "policy", "creating"].includes(a.phase) ? "active" : "pending";
      const E: { d: string; cls: string }[] = [];
      const link = (f: string, t: string, k: string) => { const p = pt(f, "r"), q = pt(t, "l"); if (!p || !q) return; const mx = (p.x + q.x) / 2; E.push({ d: `M${p.x},${p.y} C${mx},${p.y} ${mx},${q.y} ${q.x},${q.y}`, cls: k }); };
      const co = run.agents.find((a) => a.role === "coordinator"), iv = run.agents.filter((a) => a.role === "investigator"), sy = run.agents.find((a) => a.role === "synthesizer"), se = run.agents.find((a) => a.role === "sender");
      if (co) iv.forEach((w) => link(co.name, w.name, cls(w)));
      if (sy) iv.forEach((w) => link(w.name, sy.name, cls(sy)));
      if (sy && se) link(sy.name, se.name, cls(se));
      setEdges(E);
    };
    compute(); const t = setTimeout(compute, 60); window.addEventListener("resize", compute);
    return () => { clearTimeout(t); window.removeEventListener("resize", compute); };
  }, [run?.agents, run?.status]);

  const go = async () => { setSel(null); setRun(await startRun({ incidentId, posture })); };
  const busy = !!run && !["sent", "rejected", "error", "cancelled"].includes(run.status);
  const allow = run?.egress.filter((e) => e.decision === "allow").length ?? 0;
  const deny = run?.egress.filter((e) => e.decision === "deny").length ?? 0;
  const selected = run?.agents.find((a) => a.name === sel?.name) || null;
  const investigators = run?.agents.filter((a) => a.role === "investigator") ?? [];
  const allSteps = run ? run.agents.flatMap((a) => a.steps.map((s) => ({ a, s }))).sort((x, y) => x.s.id - y.s.id) : [];
  const fleetTokens = run ? run.agents.reduce((n, a) => n + (a.metrics?.tokens ?? 0), 0) : 0;
  const fleetCost = run ? run.agents.reduce((n, a) => n + (a.metrics?.costUsd ?? 0), 0) : 0;
  const cols = run ? (["coordinator", "investigator", "synthesizer", "sender"] as const).map((k) => ({ key: k, nodes: run.agents.filter((a) => a.role === k) })) : [];

  return (
    <div className="app">
      {/* In-page sub-toolbar — sits under the site nav (SiteHeader), not a second site header.
          Styled with the site tokens so it reads as one consistent page header band. The
          theme toggle lives in SiteHeader only (no duplicate here). */}
      <header className="idesk-subbar">
        <div className="idesk-title">
          <span className="idesk-mark">{I(ShieldCheck, 15)}</span>
          <span className="idesk-name">Incident Desk</span>
          <span className="idesk-tagline">policy-scoped agent fleet · human-in-the-loop RCA</span>
        </div>
        {run && <span className="tb-status"><StatusPill status={run.status} gate={run.gate} /></span>}
        <div className="tb-right">
          <button className={`tb-link ${autopilot ? "on" : ""}`} onClick={toggleAutopilot} title="background watcher auto-runs the fleet + auto-remediates on detected incidents">{I(Zap, 13)} Autopilot {autopilot ? "ON" : "off"}</button>
          {run && <button className="tb-link" onClick={() => { setRun(null); setSel(null); location.hash = ""; }}>{I(Play, 13)} New incident</button>}
          <div style={{ position: "relative" }}>
            <button className="tb-link" onClick={() => { setShowHist(!showHist); refreshHistory(); }}>{I(History, 14)} History</button>
            {showHist && (
              <div className="histmenu">
                {!history.length && <div className="muted small" style={{ padding: 10 }}>no runs yet</div>}
                {history.map((h) => (
                  <button key={h.id} className={`histrow ${run?.id === h.id ? "on" : ""}`} onClick={() => openRun(h.id)}>
                    <span className={`pill ${h.status}`} style={{ padding: "2px 8px", fontSize: 10 }}><span className="dotled" />{h.status.replace("-", " ")}</span>
                    <span className="histttl">{h.title}</span>
                    <span className="muted" style={{ fontSize: 10, marginLeft: "auto" }}>{new Date(h.createdAt).toLocaleTimeString()}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {tele?.dashboards?.[0] && <a className="tb-link" href={tele.dashboards[0].url} target="_blank" rel="noreferrer">{I(BarChart3)} Grafana</a>}
          <a className="tb-link" href="/mailpit" target="_blank" rel="noreferrer">{I(Inbox)} Inbox</a>
        </div>
      </header>

      {!run && (
        <div className="wrap">
          <div className="launch">
            <div className="launch-head"><h2>Investigate an incident</h2><p>Launch a policy-scoped agent fleet to find the root cause — you stay in the loop.</p></div>
            <div className="section-l">1 · Choose an incident</div>
            <div className="incident-grid">
              {incidents.map((inc) => (
                <button key={inc.id} className={`inc-card ${incidentId === inc.id ? "sel" : ""}`} onClick={() => setIncidentId(inc.id)}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <span className="sev">{inc.severity}</span>
                    {inc.live ? <span className="sev" style={{ color: "var(--teal)", background: "var(--teal-dim)" }}>● LIVE — real app</span> : <span className="sev" style={{ color: "var(--text-3)", background: "var(--bg-base)" }}>scripted</span>}
                  </div>
                  <h3>{inc.title}</h3>
                  <div className="sympt">{detail && detail.id === inc.id ? detail.symptoms : "Click to view the alert + evidence sources."}</div>
                </button>
              ))}
            </div>
            <div className="launch-foot">
              <div className="posture-pick"><span className="lab">2 · Initial egress posture</span>
                <div className="seg">{POSTURES.map((p) => <button key={p} className={posture === p ? "on" : ""} onClick={() => setPosture(p)}>{p}</button>)}</div>
              </div>
              <button className="btn go" style={{ marginLeft: "auto" }} onClick={go} disabled={!incidentId}>{I(Play)} Launch fleet</button>
            </div>

            {detail && (
              <div className="launch-cols">
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                  {detail.live && <LiveHealth incidentId={incidentId} />}
                  {history.length > 0 && (
                    <div className="panel">
                      <div className="panel-h">{I(History)}<h3>Recent runs</h3><span className="muted" style={{ marginLeft: "auto" }}>{history.length}</span></div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: 240, overflow: "auto" }}>
                        {history.slice(0, 12).map((h) => (
                          <button key={h.id} className="histrow" onClick={() => openRun(h.id)}>
                            <span className={`pill ${h.status}`} style={{ padding: "2px 8px", fontSize: 10 }}><span className="dotled" />{h.status.replace("-", " ")}</span>
                            <span className="histttl">{h.title}</span>
                            <span className="muted" style={{ fontSize: 10, marginLeft: "auto" }}>{new Date(h.createdAt).toLocaleTimeString()}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="panel">
                    <div className="panel-h">{I(Activity)}<h3>Evidence sources</h3>{detail.live && <span className="sev" style={{ marginLeft: "auto", color: "var(--teal)", background: "var(--teal-dim)" }}>● real telemetry</span>}</div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      {detail.sources.map((s) => (
                        <div key={s.kind} className="chip" style={{ padding: "8px 12px", display: "flex", gap: 8, alignItems: "center" }}>{I(SRC[s.kind])} <b>{s.label}</b> <span className="muted">· {s.hint}</span></div>
                      ))}
                    </div>
                  </div>
                  <div className="panel">
                    <div className="panel-h">{I(Workflow)}<h3>How this use case works</h3></div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {FLOW.map((f, i) => (
                        <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                          <div style={{ color: "var(--accent-bright)", marginTop: 1 }}>{I(f.Icon)}</div>
                          <div><b style={{ fontSize: 12.5 }}>{i + 1}. {f.t}</b><div className="muted" style={{ lineHeight: 1.5 }}>{f.d}</div></div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                  <Architecture live={!!detail.live} />
                  <WarmPool />
                </div>
              </div>
            )}

            {detail && (
              <div className="panel" style={{ marginTop: 18 }}>
                <div className="panel-h">{I(Shield)}<h3>Per-agent egress policy (YAML)</h3>
                  <span className="muted">investigators at <span className={`pchip ${posture}`}>{posture}</span> — one scoped sandbox per role</span></div>
                <div className="board">
                  <div><div className="diff-head">{I(Compass, 12)} coordinator (triage)</div><pre className="code yaml">{rolePolicyYaml("coordinator", undefined, posture, !!detail.live)}</pre></div>
                  {detail.sources.map((s) => (
                    <div key={s.kind}><div className="diff-head">{I(SRC[s.kind], 12)} {s.kind} investigator</div><pre className="code yaml">{rolePolicyYaml("investigator", s.kind, posture, !!detail.live)}</pre></div>
                  ))}
                  <div><div className="diff-head">{I(GitMerge, 12)} synthesizer</div><pre className="code yaml">{rolePolicyYaml("synthesizer", undefined, posture, !!detail.live)}</pre></div>
                  <div><div className="diff-head">{I(Send, 12)} sender</div><pre className="code yaml">{rolePolicyYaml("sender", undefined, posture, !!detail.live)}</pre></div>
                </div>
                <div className="muted small" style={{ marginTop: 10 }}>{detail.live ? "Coordinator/synthesizer reach only the model; each investigator is authorized for its one internal system; sender only mail. External internet is default-deny — switch posture to grant the vendor-advisory lookup." : "Evidence injected in-band; egress policy governs external enrichment. Default-deny."}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {run && (
        <div className="wrap">
          <div className="runhead">
            <div><h2>{run.title}</h2><div className="sub">{run.symptoms.slice(0, 130)}{run.symptoms.length > 130 ? "…" : ""}</div></div>
            <div className="kpis">
              <span className="kpi ok">{I(CheckCircle2, 12)} <b>{allow}</b> allowed</span>
              <span className="kpi no">{I(XCircle, 12)} <b>{deny}</b> denied</span>
              <span className="kpi">{I(Coins, 12)} <b>{fleetTokens}</b> tok · ${fleetCost.toFixed(4)}</span>
              <div className="seg" title="hot-reload egress posture for ALL investigators">{POSTURES.map((p) => <button key={p} className={run.posture === p ? "on" : ""} disabled={!busy} onClick={() => hotReloadPolicy(run.id, "all", p)}>{p}</button>)}</div>
              {busy && <button className="btn danger sm" onClick={() => cancelRun(run.id)}>{I(X, 12)} Cancel</button>}
              {run.traceId && tele && <a className="btn sm" href={traceUrl(tele.grafanaUrl, run.traceId)} target="_blank" rel="noreferrer" title="open this run's trace in Grafana Tempo">{I(Network, 12)} Trace</a>}
              <span className="runid">run {run.id}</span>
            </div>
          </div>

          <section className="pipeline" ref={canvasRef}>
            <svg className="edges">{edges.map((e, i) => <path key={i} d={e.d} className={`edge ${e.cls}`} />)}</svg>
            {cols.map((col) => (
              <div className="stage" key={col.key}>
                <div className="stage-title">{ROLE[col.key].stage}</div>
                <div className="stage-nodes">
                  {col.nodes.map((a) => <Node key={a.name} a={a} run={run} selected={sel?.name === a.name} onOpen={(t) => setSel({ name: a.name, tab: t })} nodeRef={(el) => { if (el) nodeEls.current.set(a.name, el); else nodeEls.current.delete(a.name); }} />)}
                  {!col.nodes.length && <div className="stage-empty">·</div>}
                </div>
              </div>
            ))}
          </section>

          {run.status === "awaiting-approval" && run.gate === "findings" && (
            <div className="gate">{I(autopilot || run.autopilot ? Zap : Eye, 18)}<div>{run.autopilot ? <><b>Autopilot — auto-approving findings…</b> the fleet correlates without waiting (hands-off).</> : <><b>Review the findings below.</b> Each investigator reported from its scoped evidence. Approve to correlate into a root cause, or open an agent to redirect it / hot-reload its policy and re-run.</>}</div>
              {!run.autopilot && <button className="btn primary" onClick={() => approve(run.id)}>{I(GitMerge)} Approve → correlate</button>}</div>
          )}

          <div className="cols">
            <div>
              <div className="section-l" style={{ margin: "4px 0 12px" }}>Investigation · findings &amp; steps</div>
              {!investigators.length && <div className="panel"><div className="muted">Triage is forming hypotheses…</div></div>}
              <div className="board">
                {investigators.map((a) => <InvCard key={a.name} a={a} run={run} onOpen={(t) => setSel({ name: a.name, tab: t })} />)}
              </div>
              {run.report && (
                <div className="panel" style={{ marginTop: 16 }}>
                  <div className="panel-h">{I(FileText)}<h3>Root cause &amp; remediation runbook</h3>
                    <span className="muted">by synthesizer</span></div>
                  <div className="report-body" dangerouslySetInnerHTML={{ __html: marked.parse(run.report) as string }} />
                  {run.status === "awaiting-approval" && run.gate === "runbook" && (
                    run.autopilot
                      ? <div className="muted small" style={{ marginTop: 14, display: "flex", gap: 8, alignItems: "center" }}><span className="spinner" /> Autopilot — auto-applying remediation &amp; sending the runbook…</div>
                      : <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                          <button className="btn go" onClick={() => approve(run.id)}>{I(Send)} Approve &amp; send runbook</button>
                          <button className="btn danger" onClick={() => reject(run.id)}>Reject</button>
                        </div>
                  )}
                  {run.status === "sent" && <div style={{ marginTop: 12, color: "var(--teal)", fontWeight: 600 }}>{I(CheckCircle2)} Runbook delivered — open the Inbox.</div>}
                  {run.remediation && (
                    <div style={{ marginTop: 14, padding: 14, border: "1px solid var(--border)", borderRadius: "var(--r-md)", background: "var(--bg-elevated)" }}>
                      <div className="dtitle">{I(Zap, 12)} Real remediation (applies to the live cluster)</div>
                      <div className="muted" style={{ marginBottom: 10 }}>{run.remediation.description}</div>
                      {run.remediation.diff && run.remediation.diff.length > 0 && (
                        <><div className="diff-head">{I(FileText, 12)} configmap/{run.incidentId === "orders-pool" ? "orders-config" : "config"} — proposed change</div>
                        <pre className="code diff">
                          {run.remediation.diff.map((d, i) => <span key={i}><div className="dl del">- {d.key}: {d.before}</div><div className="dl add">+ {d.key}: {d.after}</div></span>)}
                        </pre></>
                      )}
                      {run.autopilot && !run.remediation.applied
                        ? <div className="muted small">Autopilot will pick a fix, open + merge the PR automatically.</div>
                        : !run.remediation.applied
                        ? (run.remediation.options && run.remediation.options.length
                            ? <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                <div className="muted small">Choose a fix — each opens a PR you review &amp; merge:</div>
                                {run.remediation.options.map((o) => (
                                  <button key={o.id} className="btn go" style={{ flexDirection: "column", alignItems: "flex-start", gap: 2 }} onClick={() => remediateRun(run.id, o.id)}>
                                    <span>{I(o.id.includes("memory") ? Cpu : GitMerge, 13)} {o.label}</span>
                                    <span style={{ fontWeight: 400, fontSize: 11, opacity: .85 }}>{o.description}</span>
                                  </button>
                                ))}
                              </div>
                            : <button className="btn go" onClick={() => remediateRun(run.id)}>{I(Zap)} Apply remediation</button>)
                        : <div style={{ color: "var(--teal)", fontWeight: 600 }}>{I(CheckCircle2)} {run.remediation.note}
                            {run.remediation.prUrl && <> · <a href={run.remediation.prUrl} target="_blank" rel="noreferrer" style={{ color: "var(--accent-bright)" }}>review &amp; merge PR ↗</a></>}
                            {tele?.dashboards?.[0] && <> · <a href={tele.dashboards[0].url} target="_blank" rel="noreferrer" style={{ color: "var(--accent-bright)" }}>Grafana ↗</a></>}</div>}
                      {run.live && <RecoveryMetrics incidentId={run.incidentId} />}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="panel">
              <div className="deck-tabs">
                {([["timeline", Activity, "Timeline"], ["egress", Shield, "Egress"], ["cost", Gauge, "Telemetry"], ["dash", BarChart3, "Dashboards"]] as const).map(([d, Ic, l]) => (
                  <button key={d} className={deck === d ? "on" : ""} onClick={() => setDeck(d as Deck)}>{I(Ic)} {l}</button>
                ))}
              </div>
              {deck === "timeline" && <Timeline steps={allSteps} onOpen={(n) => setSel({ name: n, tab: "steps" })} />}
              {deck === "egress" && <EgressFull run={run} />}
              {deck === "cost" && <CostPanel run={run} llm={llm} tele={tele} fleetTokens={fleetTokens} fleetCost={fleetCost} />}
              {deck === "dash" && <Dashboards tele={tele} theme={theme} />}
            </div>
          </div>
        </div>
      )}

      {selected && sel && <Drawer key={selected.name} run={run!} a={selected} initial={sel.tab} onClose={() => setSel(null)} />}
    </div>
  );
}

const SRC_SYS: Record<SourceKind, string> = { logs: "Loki", metrics: "Prometheus", traces: "Tempo", changes: "K8s API + Postgres" };
function Architecture({ live }: { live: boolean }) {
  const box = (Icon: any, t: string, sub?: string, color?: string) => (
    <div className="arch-box" style={{ ["--ac" as any]: color || "var(--accent)" }}>
      <div className="arch-t">{I(Icon, 13)} {t}</div>{sub && <div className="arch-s">{sub}</div>}
    </div>
  );
  return (
    <div className="panel" style={{ marginTop: 16 }}>
      <div className="panel-h">{I(Workflow)}<h3>System architecture {live && <span className="muted">· live data flow</span>}</h3></div>
      <div className="arch">
        <div className="arch-col">
          <div className="arch-h">Evidence sources</div>
          {box(Database, "demo-shop", "orders-api + Postgres (real app under load)", "#06d6a0")}
          {box(ScrollText, "Loki", "logs", "#7c6fff")}
          {box(LineChart, "Prometheus", "metrics", "#7c6fff")}
          {box(Network, "Tempo", "traces", "#7c6fff")}
          {box(History, "K8s API", "config / deploys", "#7c6fff")}
        </div>
        <div className="arch-arrow">{I(ArrowUpRight, 18)}<span>pulled by backend</span></div>
        <div className="arch-col">
          <div className="arch-h">Agent fleet · gVisor sandboxes (policy-scoped)</div>
          {box(Compass, "Coordinator", "triage → hypotheses · egress: model only", "#f59e0b")}
          <div className="arch-map">
            {(["logs", "metrics", "traces", "changes"] as SourceKind[]).map((s) => (
              <div key={s} className="arch-maprow"><span className="arch-mapa">{I(SRC[s], 12)} {s} investigator</span><span className="arch-arr">←</span><span className="arch-mapb">{SRC_SYS[s]}</span></div>
            ))}
          </div>
          {box(GitMerge, "Synthesizer", "correlate → root cause + runbook", "#a78bfa")}
          {box(Send, "Sender", "egress: mailpit only", "#06d6a0")}
        </div>
        <div className="arch-arrow">{I(ArrowUpRight, 18)}<span>human-approved</span></div>
        <div className="arch-col">
          <div className="arch-h">Outputs &amp; remediation</div>
          {box(Eye, "Human gates", "review findings · approve runbook", "#f59e0b")}
          {box(Inbox, "Mailpit", "runbook delivered", "#06d6a0")}
          {box(Zap, "Direct remediation", "orders-pool: patch ConfigMap + roll", "#06d6a0")}
          {box(GitMerge, "GitOps remediation", "catalog-api: open PR → human merge → ArgoCD sync", "#76b900")}
          {box(BarChart3, "Grafana / Tempo", "unified metrics·logs·traces", "#7c6fff")}
        </div>
      </div>
      <div className="muted small" style={{ marginTop: 12 }}>Investigator sandboxes can only reach the model (<span className="mono">inference.local</span>) via the policy proxy; the backend brokers the scoped internal reads. Every model call routes <span className="mono">inference.local → LiteLLM → NIM</span>. External internet is default-deny.</div>
    </div>
  );
}

function PodList({ incidentId }: { incidentId: string }) {
  const [d, setD] = useState<{ namespace: string; pods: PodInfo[] } | null>(null);
  useEffect(() => { const t = () => getPods(incidentId).then(setD).catch(() => {}); t(); const iv = setInterval(t, 5000); return () => clearInterval(iv); }, [incidentId]);
  if (!d || !d.pods?.length) return null;
  const ok = (s: string) => /Running|Completed|Succeeded/.test(s);
  return (
    <div style={{ marginTop: 10 }}>
      <div className="diff-head">{I(Cpu, 12)} kubectl get pods · <span className="mono">{d.namespace}</span></div>
      <table className="mtable"><thead><tr><th>NAME</th><th>READY</th><th>STATUS</th><th>RESTARTS</th><th>AGE</th></tr></thead>
        <tbody>{d.pods.map((p) => (
          <tr key={p.name}>
            <td>{p.name}</td><td>{p.ready}</td>
            <td style={{ color: ok(p.status) ? "var(--teal)" : "var(--pink)" }}>{p.status}{p.lastReason ? ` (${p.lastReason})` : ""}</td>
            <td style={{ color: p.restarts > 0 ? "var(--pink)" : undefined }}>{p.restarts}</td><td>{p.age}</td>
          </tr>
        ))}</tbody></table>
    </div>
  );
}

function RecoveryMetrics({ incidentId }: { incidentId: string }) {
  const [h, setH] = useState<AppHealth | null>(null);
  useEffect(() => { const t = () => appHealth(incidentId).then(setH).catch(() => {}); t(); const iv = setInterval(t, 4000); return () => clearInterval(iv); }, [incidentId]);
  if (!h) return <div className="muted small" style={{ marginTop: 8 }}>loading live metrics…</div>;
  const issue = h.status === "issue";
  const chip = (label: string, val: any, bad?: boolean) => <div className="statcard" style={{ padding: 10 }}><div className="n" style={{ fontSize: 16, color: bad ? "var(--pink)" : "var(--teal)" }}>{val ?? "—"}</div><div className="l">{label}</div></div>;
  return (
    <div style={{ marginTop: 10 }}>
      <div className="diff-head">{I(Activity, 12)} Live recovery — orders-api
        <span className="pill" style={{ marginLeft: 8, color: issue ? "var(--pink)" : "var(--teal)", borderColor: issue ? "rgba(247,37,133,.4)" : "rgba(6,214,160,.4)", background: issue ? "var(--pink-dim)" : "var(--teal-dim)" }}><span className="dotled" style={{ background: issue ? "var(--pink)" : "var(--teal)" }} />{issue ? "unhealthy" : "healthy"}</span></div>
      <div className="cost-cards" style={{ marginTop: 6 }}>
        {chip("p99 (s)", h.p99, (h.p99 ?? 0) > 1)}
        {chip("503 / s", h.e5xxRate, (h.e5xxRate ?? 0) > 0.05)}
        {chip("200 / s", h.okRate)}
        {chip(h.restarts != null ? "restarts" : "pool waiting", h.restarts != null ? h.restarts : h.poolWaiting, (h.restarts ?? h.poolWaiting ?? 0) > 0)}
      </div>
      <PodList incidentId={incidentId} />
      <div className="muted small" style={{ marginTop: 6 }}>Watch pods + p99 / 503 / waiting return to healthy within ~30–45s of the fix (refreshes live).</div>
    </div>
  );
}

function WarmPool() {
  const pool = Array.from({ length: 8 }, (_, i) => `agent-${i}`);
  return (
    <div className="panel">
      <div className="panel-h">{I(Cpu)}<h3>Sandbox warm pool</h3><span className="muted" style={{ marginLeft: "auto" }}>8 pre-warmed · gVisor</span></div>
      <div className="pool-grid">{pool.map((a) => <div key={a} className="pool-chip">{I(ShieldCheck, 12)} {a}</div>)}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 10 }}>
        {[
          ["Pre-warmed once", "8 gVisor sandboxes (agent-0…7) are created up front and kept Ready by the OpenShell gateway as long-lived Sandbox CRs."],
          ["Allocated, not created", "On launch the orchestrator claims sandboxes from the pool (REUSE_SANDBOXES) — a run starts in ~seconds vs ~3–4 min to cold-start a fresh gVisor sandbox."],
          ["Fits one run", "coordinator + up to 4 investigators + synthesizer + sender = up to 7 → fits the pool of 8."],
          ["Kept warm + isolated", "Sandboxes are never torn down between runs (so they stay warm); each run re-applies a fresh egress policy, so nothing leaks across runs."],
        ].map(([t, d], i) => (
          <div key={i} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
            <div style={{ color: "var(--accent-bright)", marginTop: 1 }}>{I(Zap, 13)}</div>
            <div><b style={{ fontSize: 12.5 }}>{t}</b> <span className="muted" style={{ fontSize: 12 }}>— {d}</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LiveHealth({ incidentId }: { incidentId: string }) {
  const [h, setH] = useState<AppHealth | null>(null);
  const [triggering, setTriggering] = useState(false);
  useEffect(() => { const t = () => appHealth(incidentId).then(setH).catch(() => {}); t(); const iv = setInterval(t, 5000); return () => clearInterval(iv); }, [incidentId]);
  const issue = h?.status === "issue";
  useEffect(() => { if (issue) setTriggering(false); }, [issue]); // surfaced → clear the waiting banner
  const chip = (label: string, val: any, bad?: boolean) => <div className="statcard" style={{ padding: 12 }}><div className="n" style={{ fontSize: 18, color: bad ? "var(--pink)" : undefined }}>{val ?? "—"}</div><div className="l">{label}</div></div>;
  const reTrigger = () => { setTriggering(true); triggerIncident(incidentId).catch((e) => { alert(String(e)); setTriggering(false); }); setTimeout(() => setTriggering(false), 75000); };
  return (
    <div className="panel" style={{ borderColor: h ? (issue ? "rgba(247,37,133,.4)" : "rgba(6,214,160,.4)") : undefined }}>
      <div className="panel-h">{I(Activity)}<h3>Live system health — {h?.app ?? "app"}</h3>
        {h && <span className="pill" style={{ marginLeft: "auto", color: issue ? "var(--pink)" : "var(--teal)", borderColor: issue ? "rgba(247,37,133,.4)" : "rgba(6,214,160,.4)", background: issue ? "var(--pink-dim)" : "var(--teal-dim)" }}><span className="dotled" style={{ background: issue ? "var(--pink)" : "var(--teal)" }} />{issue ? "unhealthy" : "healthy"}</span>}</div>
      {triggering && !issue && (
        <div style={{ display: "flex", gap: 9, alignItems: "center", padding: "10px 12px", marginBottom: 12, borderRadius: "var(--r-md)", background: "var(--amber-dim)", border: "1px solid rgba(251,191,36,.35)", fontSize: 12.5 }}>
          <span className="spinner" /><span>Fault injected — <b>{h?.app ?? "the app"}</b> is rolling. The incident surfaces in <b>~30–45s</b> (pod restart → load saturates the pool → 10s metric scrape). This panel auto-refreshes every 5s.</span>
        </div>
      )}
      {!h ? <div className="muted">checking live telemetry…</div> : (<>
        <div className="cost-cards">
          {chip("p99 latency (s)", h.p99, (h.p99 ?? 0) > 1)}
          {chip("503 / s", h.e5xxRate, (h.e5xxRate ?? 0) > 0.05)}
          {chip("200 / s", h.okRate)}
          {chip("pool waiting", h.poolWaiting, (h.poolWaiting ?? 0) >= 1)}
          {chip("restarts", h.restarts, (h.restarts ?? 0) > 0)}
          {chip("memory (MB)", h.memMB, false)}
        </div>
        <div className="muted small" style={{ margin: "4px 0 8px" }}>db pool in_use {h.poolInUse ?? "—"} / max {h.poolMax ?? "—"}{h.podIssue ? ` · pods: ${h.podsSummary}` : ""} · live from Prometheus + Loki (refreshes 5s)</div>
        {(h.p99 == null && (h.restarts ?? 0) > 0) && <div className="muted small" style={{ margin: "0 0 8px", color: "var(--pink)" }}>No HTTP metrics — the app is crashlooping (not serving). The restarts + memory + pod table show the OOM.</div>}
        <div style={{ display: "flex", gap: 7, alignItems: "center", margin: "0 0 8px", fontSize: 11.5 }}>
          <span className="dotled" style={{ background: "var(--teal)", boxShadow: "0 0 8px var(--teal)" }} />
          <span className="muted">Load generator is <b style={{ color: "var(--text)" }}>always on</b> — continuously driving ~{Math.round(h.okRate ?? 0)} req/s at {h.app ?? "the app"} (not just on trigger).</span>
        </div>
        <div className="dtitle">{I(ScrollText, 12)} recent error logs (Loki)</div>
        <pre className="code" style={{ maxHeight: 140 }}>{h.recentErrors.length ? h.recentErrors.join("\n") : "(no recent errors — system looks healthy)"}</pre>
        <PodList incidentId={incidentId} />
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 10 }}>
          <button className="btn danger sm" onClick={reTrigger} disabled={triggering}>{I(AlertTriangle, 13)} {triggering ? "fault injected — surfacing…" : "Re-trigger incident"}</button>
          <span className="muted small">{issue ? "incident active — launch the fleet to investigate." : "healthy — re-trigger to inject the fault, then launch."}</span>
        </div>
      </>)}
    </div>
  );
}

function StatusPill({ status, gate }: { status: string; gate?: string }) {
  return <span className={`pill ${status}`}><span className="dotled" />{status.replace("-", " ")}{gate ? ` · ${gate}` : ""}</span>;
}

function Node({ a, run, selected, onOpen, nodeRef }: { a: AgentState; run: Run; selected: boolean; onOpen: (t: Tab) => void; nodeRef: (el: HTMLDivElement | null) => void }) {
  const { vis, label } = visState(a, run);
  const RoleIcon = ROLE[a.role].Icon;
  return (
    <div ref={nodeRef} className={`node ${vis} ${selected ? "sel" : ""}`} style={{ ["--rc" as any]: ROLE[a.role].color }} onClick={() => onOpen(a.role === "investigator" ? "steps" : "info")}>
      <div className="node-top">
        <span className="node-role">{I(a.source ? SRC[a.source] : RoleIcon, 12)} {a.source || a.role}</span>
        {vis === "active" ? <span className="spinner" /> : I(vis === "done" ? CheckCircle2 : vis === "error" ? XCircle : vis === "waiting" ? Clock : Circle, 13)}
      </div>
      <div className="node-label">{a.label}</div>
      <div className={`node-state ${vis}`}>{label}</div>
      <div className="node-meta">
        {a.policy.posture && <span className={`pchip ${a.policy.posture}`}>{a.policy.posture}</span>}
        {a.metrics?.tokens != null && <span className="tok">{a.metrics.tokens} tok</span>}
        {a.steps.length > 0 && <span className="tok">{a.steps.length} steps</span>}
      </div>
    </div>
  );
}

function StepRow({ a, s, showAgent }: { a?: AgentState; s: Step; showAgent?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`step ${s.ok === true ? "ok" : ""} ${s.ok === false ? "bad" : ""}`}>
      <div className="step-ic">{I(STEPI[s.kind], 11)}</div>
      <div className="step-body" onClick={() => s.detail && setOpen(!open)} style={{ cursor: s.detail ? "pointer" : "default" }}>
        <div className="step-title">
          {showAgent && a && <span className="step-agent" style={{ color: ROLE[a.role].color }}>{a.source || a.role}</span>}
          {s.title}<span className="step-time">{new Date(s.ts).toLocaleTimeString()}</span>
        </div>
        {s.detail && open && <div className="step-detail">{s.detail}</div>}
        {s.detail && !open && <div className="muted small" style={{ marginTop: 2 }}>{s.detail.split("\n")[0].slice(0, 70)}…</div>}
      </div>
    </div>
  );
}

function Timeline({ steps, onOpen }: { steps: { a: AgentState; s: Step }[]; onOpen: (n: string) => void }) {
  if (!steps.length) return <div className="muted">steps stream in as the fleet works…</div>;
  return <div className="steps">{steps.map(({ a, s }) => <div key={s.id} onClick={() => onOpen(a.name)}><StepRow a={a} s={s} showAgent /></div>)}</div>;
}

function InvCard({ a, run, onOpen }: { a: AgentState; run: Run; onOpen: (t: Tab) => void }) {
  const { vis, label } = visState(a, run);
  const eg = run.egress.filter((e) => e.agent === a.name && e.host !== "inference.local");
  const canSteer = run.status === "awaiting-approval" && run.gate === "findings";
  return (
    <div className="invcard">
      <div className="invcard-h">
        <div className="src">{I(a.source ? SRC[a.source] : Search, 16)}</div>
        <div><div className="ttl">{a.label}</div><div className={`st ${vis}`} style={{ color: vis === "done" ? "var(--teal)" : vis === "error" ? "var(--pink)" : undefined }}>{vis === "active" && <span className="spinner" style={{ display: "inline-block", verticalAlign: "middle", marginRight: 5 }} />}{label}</div></div>
        <div className="right">
          {a.policy.posture && <span className={`pchip ${a.policy.posture}`}>{a.policy.posture}</span>}
          <button className="btn sm" onClick={() => onOpen("policy")} title="policy / hot-reload">{I(Shield, 13)}</button>
        </div>
      </div>
      <div className="invcard-body">
        {a.result
          ? <div className="finding" dangerouslySetInnerHTML={{ __html: marked.parse(a.result) as string }} />
          : <div className="finding empty">{vis === "active" ? "investigating…" : "no finding yet"}</div>}
        {eg.length > 0 && <div className="invcard-egress">{eg.slice(-4).map((e, i) => <span key={i} className={`etag ${e.decision}`}>{I(e.decision === "allow" ? CheckCircle2 : XCircle, 11)}{e.host}</span>)}</div>}
        {a.steps.length > 0 && (
          <details>
            <summary className="muted small" style={{ cursor: "pointer" }}>{a.steps.length} steps · {a.metrics?.tokens ?? "?"} tok · {a.metrics?.latencyMs ?? "?"}ms</summary>
            <div className="steps" style={{ marginTop: 8 }}>{a.steps.map((s) => <StepRow key={s.id} s={s} />)}</div>
          </details>
        )}
        {canSteer && (
          <div className="invcard-controls">
            <span className="muted small">hot-reload:</span>
            <div className="seg">{POSTURES.map((p) => <button key={p} className={a.policy.posture === p ? "on" : ""} onClick={() => hotReloadPolicy(run.id, a.name, p)} title={POSTURE_DESC[p]}>{p}</button>)}</div>
            <button className="btn sm" onClick={() => redirectAgent(run.id, a.name)}>{I(RotateCw, 12)} Re-run</button>
          </div>
        )}
      </div>
    </div>
  );
}

function EgressFull({ run }: { run: Run }) {
  if (!run.egress.length) return <div className="muted">no egress yet…</div>;
  return (
    <div className="egress">{run.egress.map((e, i) => (
      <div key={i} className={`erow ${e.decision}`}>
        <div className="erow-top">
          <span className="dot">{I(e.decision === "allow" ? CheckCircle2 : XCircle, 13)}</span>
          <span className="ehost">{e.host}</span>
          {(e.binary || e.method) && <span className="ebin">{[e.binary, e.method].filter(Boolean).join(" ")}</span>}
          <span className="eagent">{e.agent.split("-").pop()}</span>
          {e.detail && <span className="edetail">{e.detail}</span>}
        </div>
        {e.url && <div className="eurl">{e.url}</div>}
      </div>
    ))}</div>
  );
}

function CostPanel({ run, llm, tele, fleetTokens, fleetCost }: { run: Run; llm: LiteLLMSummary | null; tele: TelemetryConfig | null; fleetTokens: number; fleetCost: number }) {
  const rows = run.agents.filter((a) => a.metrics?.tokens != null);
  const card = (n: any, l: string) => <div className="statcard"><div className="n">{n}</div><div className="l">{l}</div></div>;
  return (
    <div>
      <div className="section-l">This run</div>
      <div className="cost-cards">{card(fleetTokens, "tokens")}{card(`$${fleetCost.toFixed(4)}`, "cost est.")}{card(rows.length, "model calls")}{card(`${Math.max(0, ...rows.map((r) => r.metrics?.latencyMs ?? 0))}ms`, "max latency")}</div>
      <table className="mtable"><thead><tr><th>agent</th><th>tokens</th><th>in/out</th><th>latency</th><th>cost</th></tr></thead><tbody>
        {rows.map((a) => <tr key={a.name}><td style={{ color: ROLE[a.role].color }}>{a.source || a.role}</td><td>{a.metrics!.tokens}</td><td>{a.metrics!.promptTokens ?? "?"}/{a.metrics!.completionTokens ?? "?"}</td><td>{a.metrics!.latencyMs ?? "?"}ms</td><td>${(a.metrics!.costUsd ?? 0).toFixed(5)}</td></tr>)}
      </tbody></table>
      <div className="section-l" style={{ marginTop: 18 }}>LiteLLM proxy (cluster · live)</div>
      <div className="cost-cards">
        {card(llm?.tokens ?? "—", "total tokens")}
        {card(llm?.spendUsd != null ? `$${llm.spendUsd.toFixed(2)}` : "—", "total spend")}
        {card(llm?.requests ?? "—", "requests")}
        {card(llm?.inFlight ?? "—", "in-flight")}
      </div>
      <div className="cost-cards" style={{ marginTop: 12 }}>
        {card(llm?.inputTokens ?? "—", "input tokens")}
        {card(llm?.outputTokens ?? "—", "output tokens")}
        {card(llm?.avgLatencySec != null ? `${llm.avgLatencySec}s` : "—", "avg latency")}
        {card(llm?.success ?? "—", "upstream ok")}
      </div>
      <div className="muted small" style={{ marginTop: 12 }}>{tele?.note}</div>
    </div>
  );
}

function Dashboards({ tele, theme }: { tele: TelemetryConfig | null; theme: "dark" | "light" }) {
  const url = (tele?.dashboards?.[0]?.url || tele?.grafanaUrl || "/grafana").replace("theme=dark", `theme=${theme}`);
  return (
    <div>
      <div className="muted small" style={{ marginBottom: 10 }}>Live Grafana — the LiteLLM proxy dashboard provisioned on the cluster (request rate, tokens/sec, latency, spend, in-flight). Distributed traces go to <b>{tele?.tracesBackend ?? "Tempo"}</b> — use the <b>Trace</b> button in the run header to open this run's full span tree in Grafana Explore.</div>
      <iframe className="grafana" src={url} title="grafana" />
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        {tele?.dashboards?.map((d) => <a key={d.name} className="btn sm" href={d.url} target="_blank" rel="noreferrer">{I(ExternalLink, 12)} {d.name}</a>)}
      </div>
    </div>
  );
}

function Drawer({ run, a, initial, onClose }: { run: Run; a: AgentState; initial: Tab; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>(initial);
  const [logs, setLogs] = useState<string | null>(null);
  const [eff, setEff] = useState<string | null>(null);
  const [hist, setHist] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [custom, setCustom] = useState("");
  const [preview, setPreview] = useState<PolicyPosture | null>(null);
  const isInv = a.role === "investigator";
  const myAudit = run.policyAudit.filter((c) => c.agent === a.name);
  const canSteer = run.status === "awaiting-approval" && run.gate === "findings" && isInv;
  const RoleIcon = ROLE[a.role].Icon;

  useEffect(() => {
    if (tab === "logs" && logs === null) { setBusy(true); getLogs(a.name).then(setLogs).catch(() => setLogs("(failed)")).finally(() => setBusy(false)); }
    if (tab === "policy" && eff === null) { getPolicy(a.name).then(setEff).catch(() => setEff("")); getPolicyHistory(a.name).then(setHist).catch(() => setHist("")); }
  }, [tab, a.name]);

  const apply = async (p: PolicyPosture) => { await hotReloadPolicy(run.id, a.name, p, p === "custom" ? custom.split("\n").map((s) => s.trim()).filter(Boolean) : undefined); setPreview(null); setEff(null); getPolicy(a.name).then(setEff).catch(() => {}); };
  const curPosture = a.policy.posture;
  const previewRules = preview ? (preview === "custom" ? rulesForPosture("custom", custom.split("\n").map((s) => s.trim()).filter(Boolean), a.source, run.live) : rulesForPosture(preview, undefined, a.source, run.live)) : [];

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer">
        <div className="drawer-h">
          <span className="role-badge" style={{ background: ROLE[a.role].color }}>{a.source || a.role}</span>
          <strong>{a.label}</strong>
          <button className="x" onClick={onClose}>{I(X, 18)}</button>
        </div>
        <div className="tabs">
          {(["info", "steps", "think", "policy", "logs"] as Tab[]).map((t) => (
            <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>{t === "info" ? "Overview" : t === "steps" ? "Steps" : t === "think" ? "Thinking" : t === "policy" ? "Policy" : "Logs"}</button>
          ))}
        </div>

        {tab === "info" && (<>
          {a.query && <div className="dblock"><div className="dtitle">{I(FileText, 12)} Task</div><pre className="code">{a.query}</pre></div>}
          {a.metrics && <div className="dblock"><div className="dtitle">{I(Gauge, 12)} Metrics</div><table><tbody>
            <tr><td>tokens</td><td>{a.metrics.tokens ?? "?"} ({a.metrics.promptTokens ?? "?"}/{a.metrics.completionTokens ?? "?"})</td></tr>
            <tr><td>latency</td><td>{a.metrics.latencyMs ?? "?"} ms</td></tr><tr><td>cost</td><td>${(a.metrics.costUsd ?? 0).toFixed(5)}</td></tr></tbody></table></div>}
          {a.spawn && <div className="dblock"><div className="dtitle">{I(Cpu, 12)} Sandbox {a.spawn.reused && <span className="muted">· reused</span>}</div><table><tbody>
            <tr><td>image</td><td className="mono">{a.spawn.image}</td></tr><tr><td>runtime</td><td>{a.spawn.runtime}</td></tr><tr><td>command</td><td className="mono">{a.spawn.createCmd}</td></tr></tbody></table></div>}
          {a.result && <div className="dblock"><div className="dtitle">{I(CheckCircle2, 12)} Finding</div><div className="finding" dangerouslySetInnerHTML={{ __html: marked.parse(a.result) as string }} /></div>}
        </>)}

        {tab === "steps" && <div className="dblock"><div className="dtitle">{I(Activity, 12)} Step-by-step path ({a.steps.length})</div>
          <div className="steps">{a.steps.length ? a.steps.map((s) => <StepRow key={s.id} s={s} />) : <div className="muted">no steps yet…</div>}</div></div>}

        {tab === "think" && <div className="dblock"><div className="dtitle">{I(Brain, 12)} Model reasoning</div>
          <pre className="code">{a.thinking?.trim() || (a.role === "synthesizer" ? "Reasoning suppressed for the report writer to keep the RCA clean." : a.phase === "done" ? "No reasoning returned." : "Reasoning appears once this agent runs…")}</pre></div>}

        {tab === "policy" && (<>
          <div className="dblock"><div className="dtitle">{I(Shield, 12)} Effective policy (YAML){curPosture && <span className={`pchip ${curPosture}`}>{curPosture}</span>}</div><pre className="code yaml">{policyYaml(a)}</pre></div>
          {isInv && <div className="dblock"><div className="dtitle">{I(Zap, 12)} Hot-reload posture → live sandbox</div>
            <div className="posture-row">{POSTURES.map((p) => <button key={p} className={`btn sm ${(preview ?? curPosture) === p ? "primary" : ""}`} onClick={() => setPreview(p === curPosture ? null : p)} title={POSTURE_DESC[p]}>{p}</button>)}</div>
            {preview && preview !== curPosture && (<>
              <div className="diff-head">{I(GitMerge, 12)} YAML change: <span className={`pchip ${curPosture}`}>{curPosture}</span> → <span className={`pchip ${preview}`}>{preview}</span></div>
              <YamlDiff from={policyYaml(a)} to={policyYaml(a, preview, previewRules)} />
              <button className="btn primary sm" style={{ marginTop: 8 }} onClick={() => apply(preview)}>{I(Zap, 12)} Apply &amp; hot-reload → live sandbox</button>
            </>)}
            <details style={{ marginTop: 10 }}><summary className="muted small" style={{ cursor: "pointer", marginBottom: 6 }}>custom rules</summary>
              <textarea className="rules" rows={3} value={custom} onChange={(e) => setCustom(e.target.value)} placeholder={"host:port:GET:/path/**\none rule per line"} />
              <button className="btn sm" onClick={() => apply("custom")} disabled={!custom.trim()}>Apply custom</button></details>
            <div className="muted small" style={{ marginTop: 8 }}>Pick a posture to preview the YAML diff, then Apply. Pushed via <span className="mono">openshell policy update</span>; next egress obeys. {canSteer && "Re-run the agent (Steps) to see it take effect."}</div></div>}
          {myAudit.length > 0 && <div className="dblock"><div className="dtitle">{I(History, 12)} Change audit</div>
            {myAudit.map((c, i) => <div key={i} className="audit-row"><span className={`pchip ${c.posture}`}>{c.posture}</span><span className="audit-by">{c.by}</span>{c.note && <span className="muted small">{c.note}</span>}<span className="audit-time">{new Date(c.ts).toLocaleTimeString()}</span></div>)}</div>}
          <div className="dblock"><div className="dtitle">{I(Eye, 12)} Gateway effective policy (live)</div><pre className="code">{eff === null ? "loading…" : (eff || "(none)")}</pre></div>
          {hist && <div className="dblock"><div className="dtitle">{I(History, 12)} Policy history</div><pre className="code">{hist}</pre></div>}
        </>)}

        {tab === "logs" && <div className="dblock"><div className="dtitle">{I(ScrollText, 12)} Sandbox logs</div>
          <pre className="code">{busy ? "loading…" : (logs ?? "").slice(-6000) || "(no logs)"}</pre>
          <button className="btn sm" style={{ marginTop: 8 }} onClick={() => { setLogs(null); setTab("logs"); }} disabled={busy}>{I(RotateCw, 12)} Refresh</button></div>}
      </aside>
    </>
  );
}