"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { IconShield, IconInfo, IconAlert } from "@/components/console/icons";
import { api } from "@/lib/console-api";
import { toYaml } from "@/lib/yaml";
import { Terminal } from "./Terminal";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Data = {
  name: string; phase: string; image: string; providers: string[];
  labels: Record<string, string>; networkPolicies: Record<string, any>;
  policyObj: any;
  policyVersion: number | null; policyStatus: string; activeVersion: number | null;
  attachedProviders: { name: string; type: string; config: Record<string, string>; credentials: string[] }[];
  services: { service: string; port: number; url: string; domain: boolean }[];
};

function phasePill(phase: string) {
  const raw = (phase || "").replace(/^SANDBOX_PHASE_/, "").replace(/_/g, " ").trim();
  const text = raw ? raw[0] + raw.slice(1).toLowerCase() : "Unknown";
  const p = raw.toUpperCase();
  const tone = p.includes("READY") || p.includes("RUNNING") ? "ready"
    : p.includes("FAIL") || p.includes("ERROR") || p.includes("TERMIN") || p.includes("DELET") ? "error"
    : p.includes("PEND") || p.includes("PROVISION") || p.includes("CREAT") || p.includes("INIT") ? "pending" : "unknown";
  return <span className={`pill ${tone}`}><span className="dot" />{text}</span>;
}

type Tab = "overview" | "policy" | "network" | "drafts" | "terminal" | "logs";

export function SandboxDetail({ data, isAdmin, initialTab }: { data: Data; isAdmin?: boolean; initialTab?: string }) {
  const valid: Tab[] = ["overview", "policy", "network", "drafts", "terminal", "logs"];
  const [tab, setTab] = useState<Tab>(valid.includes(initialTab as Tab) ? (initialTab as Tab) : "overview");
  const blocks = Object.entries(data.networkPolicies);

  return (
    <>
      <div className="tabs">
        <button className={`tab ${tab === "overview" ? "active" : ""}`} onClick={() => setTab("overview")}>Overview</button>
        <button className={`tab ${tab === "policy" ? "active" : ""}`} onClick={() => setTab("policy")}>Policy</button>
        <button className={`tab ${tab === "network" ? "active" : ""}`} onClick={() => setTab("network")}>Network</button>
        {isAdmin && <button className={`tab ${tab === "drafts" ? "active" : ""}`} onClick={() => setTab("drafts")}>Draft review</button>}
        {isAdmin && <button className={`tab ${tab === "terminal" ? "active" : ""}`} onClick={() => setTab("terminal")}>Terminal</button>}
        <button className={`tab ${tab === "logs" ? "active" : ""}`} onClick={() => setTab("logs")}>Logs</button>
      </div>

      {tab === "overview" && (
        <div className="panel"><div className="panel-body">
          <dl className="kv">
            <dt>Status</dt><dd>{phasePill(data.phase)}</dd>
            <dt>Image</dt><dd className="mono" style={{ fontSize: 12.5 }}>{data.image || "—"}</dd>
            <dt>Providers</dt><dd>{data.providers.length ? data.providers.map((p) => <span key={p} className="tag" style={{ marginRight: 6 }}>{p}</span>) : <span className="muted">none</span>}</dd>
            <dt>Policy version</dt><dd>{data.policyVersion ?? "—"}{data.activeVersion != null && <span className="muted"> (active: v{data.activeVersion})</span>}</dd>
            <dt>Labels</dt><dd>{Object.keys(data.labels).length ? Object.entries(data.labels).map(([k, v]) => <span key={k} className="tag" style={{ marginRight: 6 }}>{k}={v}</span>) : <span className="muted">none</span>}</dd>
          </dl>

          <h4 style={{ margin: "20px 0 10px", fontSize: 13 }}>Attached providers</h4>
          {data.attachedProviders.length === 0 ? <p className="muted" style={{ fontSize: 13, margin: 0 }}>No providers attached.</p> : (
            <div className="table-wrap"><table className="grid">
              <thead><tr><th>Name</th><th>Type</th><th>Credentials</th><th>Config</th></tr></thead>
              <tbody>{data.attachedProviders.map((p) => (
                <tr key={p.name}>
                  <td className="cell-name mono">{p.name}</td>
                  <td><span className="tag">{p.type || "—"}</span></td>
                  <td>{p.credentials.length ? p.credentials.map((k) => <span key={k} className="tag" style={{ marginRight: 6 }}>{k}</span>) : <span className="muted">—</span>}</td>
                  <td className="muted" style={{ fontSize: 12 }}>{Object.entries(p.config).map(([k, v]) => `${k}=${v}`).join(", ") || "—"}</td>
                </tr>
              ))}</tbody>
            </table></div>
          )}

          <h4 style={{ margin: "20px 0 10px", fontSize: 13 }}>Exposed services</h4>
          {data.services.length === 0 ? <p className="muted" style={{ fontSize: 13, margin: 0 }}>No services exposed.</p> : (
            <div className="table-wrap"><table className="grid">
              <thead><tr><th>Service</th><th>Port</th><th>URL</th></tr></thead>
              <tbody>{data.services.map((sv, i) => (
                <tr key={i}><td className="cell-name">{sv.service || "—"}</td><td className="mono">{sv.port || "—"}</td>
                  <td className="mono">{sv.url ? <a href={sv.url} target="_blank" rel="noreferrer">{sv.url}</a> : "—"}</td></tr>
              ))}</tbody>
            </table></div>
          )}
        </div></div>
      )}

      {tab === "policy" && <PolicyView blocks={blocks} policyObj={data.policyObj} />}
      {tab === "network" && <NetworkView name={data.name} />}
      {tab === "drafts" && isAdmin && <DraftsView name={data.name} />}
      {tab === "terminal" && isAdmin && <Terminal name={data.name} />}
      {tab === "logs" && <LogsView name={data.name} />}
    </>
  );
}

function endpointSummary(ep: any) {
  const ports = (ep.ports?.length ? ep.ports : ep.port ? [ep.port] : []).join(", ");
  const allows = (ep.rules ?? []).map((r: any) => r.allow).filter(Boolean);
  const denies = ep.denyRules ?? [];
  return (
    <div className="ep">
      <span className="host">{ep.host || "*"}{ports ? `:${ports}` : ""}</span>
      {ep.protocol && <span className="tag">{ep.protocol}</span>}
      {ep.access && <span className="tag rule-allow">{ep.access}</span>}
      {ep.enforcement && <span className="muted" style={{ fontSize: 11.5 }}>{ep.enforcement}</span>}
      {allows.map((a: any, j: number) => <span key={`a${j}`} className="rule-allow">✓ {a.method || a.command || a.operationType || "*"} {a.path || ""}</span>)}
      {denies.map((d: any, j: number) => <span key={`d${j}`} className="rule-deny">✕ {d.method || d.command || "*"} {d.path || ""}</span>)}
    </div>
  );
}

function PolicyView({ blocks, policyObj }: { blocks: [string, any][]; policyObj: any }) {
  const [view, setView] = useState<"visual" | "yaml">("visual");
  const [copied, setCopied] = useState(false);
  const yaml = view === "yaml" ? toYaml(policyObj) : "";

  if (blocks.length === 0 && !policyObj) {
    return (
      <div className="panel"><div className="empty">
        <div className="ic"><IconShield width={22} height={22} /></div>
        <h3>No network policy</h3>
        <p>This sandbox has no allow-list network policy blocks defined.</p>
      </div></div>
    );
  }
  return (
    <>
      <div className="logbar" style={{ marginBottom: 14 }}>
        <button className={view === "visual" ? "sm" : "ghost sm"} onClick={() => setView("visual")}>Visual</button>
        <button className={view === "yaml" ? "sm" : "ghost sm"} onClick={() => setView("yaml")}>YAML</button>
        {view === "yaml" && (
          <button className="ghost sm" onClick={() => { navigator.clipboard?.writeText(yaml); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
            {copied ? "Copied" : "Copy"}
          </button>
        )}
      </div>

      {view === "yaml" ? (
        <pre className="code" style={{ maxHeight: 560 }}>{yaml}</pre>
      ) : blocks.length === 0 ? (
        <div className="panel"><div className="empty"><p>No network-policy blocks (see YAML for filesystem / process rules).</p></div></div>
      ) : (
      <>
      <div className="alert info" style={{ marginBottom: 16 }}>
        <IconInfo /><div>These are the <b>allowed</b> egress endpoints. Anything not listed is blocked by the
          policy proxy — denied attempts show in the <b>Logs</b> tab (look for <span className="mono">DENIED</span>).</div>
      </div>
      {blocks.map(([blockName, rule]) => {
        const endpoints = rule?.endpoints ?? [];
        const binaries = (rule?.binaries ?? []).map((b: any) => b?.path).filter(Boolean);
        return (
          <div className="policy-block" key={blockName}>
            <h4><IconShield width={15} height={15} style={{ color: "var(--accent)" }} /> {blockName}</h4>
            {endpoints.length === 0 ? <div className="muted" style={{ fontSize: 12.5 }}>No endpoints.</div> : endpoints.map((ep: any, i: number) => <div key={i}>{endpointSummary(ep)}</div>)}
            {binaries.length > 0 && <div className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>Binaries: {binaries.map((b: string) => <span key={b} className="mono" style={{ marginRight: 8 }}>{b}</span>)}</div>}
          </div>
        );
      })}
      </>
      )}
    </>
  );
}

/* ---------------- Draft policy review ---------------- */
function DraftsView({ name }: { name: string }) {
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const r = await fetch(api(`/api/sandboxes/${encodeURIComponent(name)}/drafts`));
      const d = await r.json();
      if (!r.ok) setErr(d.error ?? "failed to load drafts");
      else setData(d);
    } catch (e) { setErr(String(e)); }
  }, [name]);
  useEffect(() => { load(); }, [load]);

  async function act(action: string, body: any = {}) {
    setBusy(action + (body.chunkId || "")); setErr(null);
    const r = await fetch(api(`/api/sandboxes/${encodeURIComponent(name)}/drafts`), {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, ...body }),
    });
    const d = await r.json();
    setBusy(null);
    if (!r.ok) setErr(d.error ?? "action failed");
    else load();
  }

  const chunks: any[] = data?.chunks ?? [];
  const pending = chunks.filter((c) => (c.status || "pending") === "pending");

  return (
    <div className="panel"><div className="panel-body">
      <div className="logbar">
        <span style={{ fontWeight: 600 }}>Policy advisor — proposed rules</span>
        <button className="ghost sm" onClick={load}>Refresh</button>
        {pending.length > 0 && <>
          <button className="sm" disabled={!!busy} onClick={() => act("approve-all")}>Approve all safe</button>
          <button className="danger sm" disabled={!!busy} onClick={() => act("clear")}>Clear all</button>
        </>}
        {data?.draftVersion != null && <span className="muted" style={{ fontSize: 12 }}>draft v{data.draftVersion}</span>}
      </div>

      {err && <div className="alert error" style={{ marginBottom: 12 }}><IconAlert /><div>{err}</div></div>}
      {data?.rollingSummary && <div className="alert info" style={{ marginBottom: 14 }}><IconInfo /><div>{data.rollingSummary}</div></div>}

      {chunks.length === 0 && !err ? (
        <div className="empty">
          <div className="ic"><IconShield width={22} height={22} /></div>
          <h3>No proposed rules</h3>
          <p>When the in-sandbox agent hits denied egress, the policy advisor proposes narrow allow-rules here for your review.</p>
        </div>
      ) : chunks.map((c) => {
        const st = c.status || "pending";
        const tone = st === "approved" ? "ready" : st === "rejected" ? "error" : "pending";
        const rule = c.proposedRule ?? {};
        return (
          <div className="policy-block" key={c.id}>
            <h4 style={{ justifyContent: "space-between" }}>
              <span><IconShield width={15} height={15} style={{ color: "var(--accent)" }} /> {c.ruleName || rule.name || c.id}</span>
              <span className={`pill ${tone}`}><span className="dot" />{st}</span>
            </h4>
            {(rule.endpoints ?? []).map((ep: any, i: number) => <div key={i}>{endpointSummary(ep)}</div>)}
            {c.binary && <div className="muted" style={{ fontSize: 11.5, marginTop: 6 }}>Triggered by <span className="mono">{c.binary}</span>{c.hitCount ? ` · ${c.hitCount} hits` : ""}{c.confidence ? ` · confidence ${Math.round(c.confidence * 100)}%` : ""}</div>}
            {c.rationale && <p style={{ fontSize: 12.5, color: "var(--text-dim)", margin: "8px 0 0" }}>{c.rationale}</p>}
            {c.securityNotes && <div className="alert error" style={{ marginTop: 8, padding: "8px 12px" }}><IconAlert /><div>{c.securityNotes}</div></div>}
            {c.validationResult && <div className="muted" style={{ fontSize: 11.5, marginTop: 6 }}>Validation: {c.validationResult}</div>}
            {c.rejectionReason && <div className="muted" style={{ fontSize: 11.5, marginTop: 6 }}>Rejected: {c.rejectionReason}</div>}
            <div className="actionbar" style={{ marginTop: 12 }}>
              {st === "pending" ? (
                <>
                  <button className="sm" disabled={busy === "approve" + c.id} onClick={() => act("approve", { chunkId: c.id })}>{busy === "approve" + c.id ? "…" : "Approve"}</button>
                  <button className="danger sm" disabled={busy === "reject" + c.id} onClick={() => { const reason = window.prompt("Rejection reason (optional, shown to the agent):") ?? ""; act("reject", { chunkId: c.id, reason }); }}>Reject</button>
                </>
              ) : (
                <button className="ghost sm" disabled={busy === "undo" + c.id} onClick={() => act("undo", { chunkId: c.id })}>{busy === "undo" + c.id ? "…" : "Undo decision"}</button>
              )}
            </div>
          </div>
        );
      })}

      {(data?.history?.length ?? 0) > 0 && (
        <div style={{ marginTop: 22 }}>
          <h4 style={{ fontSize: 13, margin: "0 0 10px" }}>Decision history</h4>
          <div className="logview" style={{ maxHeight: 240 }}>
            {data.history.map((h: any, i: number) => (
              <div key={i} className="logline" style={{ gridTemplateColumns: "84px 110px 1fr" }}>
                <span className="lt">{(() => { const d = new Date(Number(h.timestampMs)); return isNaN(+d) ? "" : d.toISOString().slice(5, 16).replace("T", " "); })()}</span>
                <span className="ll" style={{ color: h.eventType === "approved" ? "var(--green)" : h.eventType === "rejected" ? "var(--red)" : "var(--text-dim)" }}>{h.eventType}</span>
                <span className="lm">{h.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div></div>
  );
}

/* ---------------- Network / egress feed ---------------- */
type Line = { timestampMs?: string; level?: string; source?: string; message?: string; target?: string; fields?: Record<string, string> };

// Server-parsed OCSF egress event (see /api/sandboxes/<name>/egress).
type Egress = { ts: string; kind: string; level: string; verdict: "allow" | "deny" | "info"; binary: string; dst: string; reason: string; raw: string };

function NetworkView({ name }: { name: string }) {
  const [events, setEvents] = useState<Egress[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [live, setLive] = useState(false);
  const [onlyDenied, setOnlyDenied] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const viewRef = useRef<HTMLDivElement>(null);

  // On-demand bounded tail via ExecSandbox — runs only while this tab is open,
  // and repeats only when Live is on. No persistent server-side tail.
  const load = useCallback(async () => {
    setErr(null);
    try {
      const r = await fetch(api(`/api/sandboxes/${encodeURIComponent(name)}/egress?lines=400`));
      const d = await r.json();
      if (!r.ok) { setErr(d.error ?? "failed to load"); setLoaded(true); return; }
      // Keep NET/HTTP egress with a resolved destination (drops empty internal noise).
      setEvents((d.events ?? []).filter((e: Egress) => (e.kind === "NET" || e.kind === "HTTP") && e.dst));
    } catch (e) { setErr(String(e)); }
    setLoaded(true);
  }, [name]);

  useEffect(() => { load(); }, [load]);
  // Live tail (default off). The interval is cleared on unmount / when stopped,
  // so leaving the tab stops all work for this sandbox.
  useEffect(() => { if (!live) return; const id = setInterval(load, 4000); return () => clearInterval(id); }, [live, load]);
  useEffect(() => { if (live && viewRef.current) viewRef.current.scrollTop = viewRef.current.scrollHeight; }, [events, live]);

  const fmt = (ts: string) => { const d = new Date(ts); return isNaN(+d) ? (ts || "").slice(11, 19) : d.toISOString().slice(11, 19); };
  const shown = onlyDenied ? events.filter((e) => e.verdict === "deny") : events;
  const denied = events.filter((e) => e.verdict === "deny").length;
  const allowed = events.filter((e) => e.verdict === "allow").length;

  return (
    <div className="panel"><div className="panel-body">
      <div className="alert info" style={{ marginBottom: 14 }}>
        <IconInfo /><div>Egress the sandbox attempted, with the policy proxy&apos;s verdict.
          <span className="rule-allow"> ALLOW</span> = matched the policy; <span className="rule-deny">DENY</span> = blocked.
          Denied destinations are candidates for the <b>Draft review</b> inbox. Read on demand from the sandbox&apos;s OCSF log.</div>
      </div>
      <div className="logbar">
        <span className="pill ready"><span className="dot" />{allowed} allowed</span>
        <span className="pill error"><span className="dot" />{denied} denied</span>
        <label className="muted" style={{ fontSize: 12.5, display: "flex", gap: 6, alignItems: "center" }}>
          <input type="checkbox" style={{ width: "auto" }} checked={onlyDenied} onChange={(e) => setOnlyDenied(e.target.checked)} /> denied only
        </label>
        <button className="ghost sm" onClick={load}>Refresh</button>
        <button className={live ? "sm" : "ghost sm"} onClick={() => setLive((v) => !v)}>{live ? "Live · stop" : "Live tail"}</button>
      </div>
      {err && <div className="alert error" style={{ marginBottom: 12 }}>{err}</div>}
      {shown.length === 0 ? (
        <div className="empty">
          <p>{!loaded ? "Loading…" : onlyDenied ? "No denied egress recorded." : "No egress events recorded yet — they appear here as the sandbox makes network requests."}</p>
        </div>
      ) : (
        <div className="logview" ref={viewRef}>
          <table className="grid" style={{ fontSize: 12.5 }}>
            <thead><tr><th>Time</th><th>Process</th><th>Destination</th><th>Verdict</th><th>Detail</th></tr></thead>
            <tbody>
              {shown.map((e, i) => (
                <tr key={i}>
                  <td className="lt mono">{fmt(e.ts)}</td>
                  <td className="mono" style={{ maxWidth: 170, overflow: "hidden", textOverflow: "ellipsis" }} title={e.binary}>{e.binary || "—"}</td>
                  <td className="mono">{e.dst || "—"}</td>
                  <td>{e.verdict === "deny" ? <span className="pill error"><span className="dot" />DENY</span>
                    : e.verdict === "allow" ? <span className="pill ready"><span className="dot" />ALLOW</span>
                    : <span className="pill unknown"><span className="dot" />{e.kind.toLowerCase()}</span>}</td>
                  <td className="muted" style={{ maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis" }} title={e.reason || e.raw}>{e.reason || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div></div>
  );
}

/* ---------------- Logs ---------------- */

function LogsView({ name }: { name: string }) {
  const [logs, setLogs] = useState<Line[]>([]);
  const [source, setSource] = useState("");
  const [loading, setLoading] = useState(false);
  const [live, setLive] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const viewRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const q = new URLSearchParams({ lines: "500", ...(source ? { source } : {}) });
      const r = await fetch(api(`/api/sandboxes/${encodeURIComponent(name)}/logs?${q}`));
      const d = await r.json();
      if (!r.ok) setErr(d.error ?? "failed to load logs");
      else setLogs(d.logs ?? []);
    } catch (e) { setErr(String(e)); }
    setLoading(false);
  }, [name, source]);

  useEffect(() => { load(); }, [load]);

  // Live tail: poll every 3s while enabled.
  useEffect(() => {
    if (!live) return;
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
  }, [live, load]);

  // Auto-scroll to bottom when tailing.
  useEffect(() => { if (live && viewRef.current) viewRef.current.scrollTop = viewRef.current.scrollHeight; }, [logs, live]);

  const fmt = (ms?: string) => { const n = Number(ms); if (!n) return ""; return new Date(n).toISOString().slice(11, 19); };
  const isDeny = (l: Line) => /DENI|BLOCK/i.test(l.message || "") || /deny|block/i.test(l.fields?.action || "");

  return (
    <div className="panel"><div className="panel-body">
      <div className="logbar">
        <select value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="">All sources</option>
          <option value="sandbox">Sandbox (supervisor)</option>
          <option value="gateway">Gateway</option>
        </select>
        <button className="ghost sm" onClick={load} disabled={loading}>{loading ? "Loading…" : "Refresh"}</button>
        <button className={live ? "sm" : "ghost sm"} onClick={() => setLive((v) => !v)}>
          <span className="dot" style={{ width: 7, height: 7, borderRadius: "50%", background: live ? "var(--accent-ink)" : "var(--green)", display: "inline-block", marginRight: 6 }} />
          {live ? "Live · stop" : "Live tail"}
        </button>
        <span className="muted" style={{ fontSize: 12 }}>{logs.length} lines · bounded recent buffer</span>
      </div>
      {err && <div className="alert error" style={{ marginBottom: 12 }}>{err}</div>}
      {logs.length === 0 && !err ? (
        <div className="empty"><p>No log lines in the buffer{live ? " yet — tailing…" : ""}.</p></div>
      ) : (
        <div className="logview" ref={viewRef}>
          {logs.map((l, i) => {
            const lvl = (l.level || "").toLowerCase();
            const deny = isDeny(l);
            return (
              <div key={i} className={`logline lvl-${lvl} ${deny ? "deny" : ""}`}>
                <span className="lt">{fmt(l.timestampMs)}</span>
                <span className="ll">{(l.level || "").toUpperCase()}{l.source ? ` ${l.source[0].toUpperCase()}` : ""}</span>
                <span className="lm">{l.message}{l.fields?.dst_host ? `  →  ${l.fields.dst_host}` : ""}</span>
              </div>
            );
          })}
        </div>
      )}
    </div></div>
  );
}
