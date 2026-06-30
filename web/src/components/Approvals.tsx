"use client";
import { useEffect, useState, useCallback } from "react";
import { RefreshCw, Check, X, UserPlus, Box, ShieldQuestion, ShieldCheck, Loader2 } from "lucide-react";

type Pending = { requestId: string; deviceId: string; clientId: string; platform: string; roles: string[]; scopes: string[]; isRepair: boolean; ts: number | null };
type Paired = { deviceId: string; clientId: string; platform: string; role: string; scopes: string[]; approvedScopes: string[]; lastSeenAtMs: number | null };

function age(ms: number | null): string {
  if (!ms) return "";
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (s < 90) return `${s}s`;
  if (s < 5400) return `${Math.floor(s / 60)}m`;
  if (s < 172800) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export function Approvals() {
  const [pending, setPending] = useState<Pending[]>([]);
  const [paired, setPaired] = useState<Paired[]>([]);
  const [sandbox, setSandbox] = useState<string>("");
  const [adminEnabled, setAdminEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string>("");
  const [msg, setMsg] = useState<string>("");
  const [err, setErr] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const dv = await fetch("/api/devices", { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
      setPending(Array.isArray(dv?.pending) ? dv.pending : []);
      setPaired(Array.isArray(dv?.paired) ? dv.paired : []);
      setSandbox(dv?.sandbox || "");
      setAdminEnabled(!!dv?.adminEnabled);
      setErr(dv?.ok === false && dv?.error ? String(dv.error) : "");
    } finally { setLoading(false); }
  }, []);

  const deviceAct = useCallback(async (requestId: string, action: "approve" | "reject") => {
    setBusy("v" + action + requestId); setMsg("");
    try {
      const j = await fetch("/api/devices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, requestId }) }).then((r) => r.json());
      setMsg(j.ok ? `device ${action} ✓` : `Error: ${j.error || j.output || "failed"}`);
      await load();
    } finally { setBusy(""); }
  }, [load]);

  // One-time: grant the operator admin rights so it can approve device pairings. Fixes the
  // "scope upgrade pending" deadlock — runs the host-privileged grant via /api/devices and
  // restarts the in-sandbox gateway.
  const enableApprovals = useCallback(async () => {
    setBusy("bootstrap"); setMsg("Enabling approvals (granting the operator admin + restarting the gateway)…");
    try {
      const j = await fetch("/api/devices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "bootstrap-admin" }) }).then((r) => r.json());
      setMsg(j.ok ? (j.output || "approvals enabled ✓") : `Error: ${j.error || "failed"}`);
      await load();
    } finally { setBusy(""); }
  }, [load]);

  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, [load]);

  return (
    <div className="mt-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-[12px] text-[var(--color-fg-mut)]">
          {pending.length} pending · {paired.length} paired
          {adminEnabled
            ? <span className="ml-1 text-[var(--color-nv-bright)]">· approvals enabled</span>
            : <span className="ml-1 text-[#e0a800]">· operator not yet admin</span>}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={load} className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-line-2)] px-2.5 py-1 text-[11px] text-[var(--color-fg-mut)] transition hover:text-[var(--color-fg)]">
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </div>
      {msg && <div className="mb-3 rounded-md border border-[var(--color-line-2)] bg-[var(--color-bg-2)] px-3 py-1.5 font-mono text-[11px] text-[var(--color-fg-dim)]">{msg}</div>}
      {err && !msg && <div className="mb-3 rounded-md border border-[#ee555544] bg-[var(--color-bg-2)] px-3 py-1.5 font-mono text-[11px] text-[#ee7777]">{err}</div>}

      {/* ---- device pairing approvals ---- */}
      <div className="flex items-center gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--color-fg)]">
          <UserPlus size={15} className="text-[var(--color-fg-mut)]" /> Device approvals
          <span className="text-[11px] font-normal text-[var(--color-fg-mut)]">— browsers / CLIs asking to pair</span>
        </h2>
        <button disabled={!!busy} onClick={enableApprovals}
          title="One-time: grant the operator admin rights so it can approve pairings. Fixes 'scope upgrade pending approval' on a fresh gateway."
          className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-[var(--color-line-2)] px-2.5 py-1 text-[11px] text-[var(--color-fg-mut)] transition hover:text-[var(--color-fg)] disabled:opacity-50">
          {busy === "bootstrap" ? <Loader2 size={12} className="animate-spin" /> : <ShieldQuestion size={12} />} Enable approvals
        </button>
      </div>

      {pending.length === 0 ? (
        <div className="mt-2 rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] p-4 text-[13px] text-[var(--color-fg-mut)]">
          None. When a new browser or CLI tries to connect to the Control UI, its pairing request appears here.
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          {pending.map((d) => (
            <div key={d.requestId} className="rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] p-3" style={{ borderColor: "#e0a80055" }}>
              <div className="flex flex-wrap items-center gap-2">
                {sandbox && <span className="inline-flex items-center gap-1 rounded border border-[var(--color-line-2)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-fg-mut)]"><Box size={10} /> {sandbox}</span>}
                <span className="font-mono text-[13px] text-[var(--color-fg)]">{(d.deviceId || d.requestId).slice(0, 16)}…</span>
                {d.clientId && <span className="rounded bg-[var(--color-line-2)] px-1.5 py-0.5 text-[9px] text-[var(--color-fg-mut)]">{d.clientId}{d.platform ? ` · ${d.platform}` : ""}</span>}
                {d.isRepair && <span className="rounded bg-[var(--color-line-2)] px-1.5 py-0.5 text-[9px] text-[var(--color-fg-mut)]">scope upgrade</span>}
                <span className="font-mono text-[10px] text-[var(--color-fg-mut)]">{(d.scopes.length ? d.scopes : d.roles).join(", ")}</span>
                {age(d.ts) && <span className="text-[10px] text-[var(--color-fg-mut)]">{age(d.ts)}</span>}
                <div className="ml-auto flex gap-2">
                  <button disabled={!!busy} onClick={() => deviceAct(d.requestId, "approve")} className="inline-flex items-center gap-1 rounded-md border border-[var(--color-nv-dim)] px-2.5 py-1 text-[12px] font-semibold text-[var(--color-nv-bright)] transition hover:bg-[var(--color-bg-2)] disabled:opacity-50"><Check size={12} /> Approve</button>
                  <button disabled={!!busy} onClick={() => deviceAct(d.requestId, "reject")} className="inline-flex items-center gap-1 rounded-md border border-[#ee5555] px-2.5 py-1 text-[12px] font-semibold text-[#ee7777] transition hover:bg-[var(--color-bg-2)] disabled:opacity-50"><X size={12} /> Deny</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ---- paired devices (current scope state) ---- */}
      <h2 className="mt-6 flex items-center gap-2 text-sm font-semibold text-[var(--color-fg)]">
        <ShieldCheck size={15} className="text-[var(--color-fg-mut)]" /> Paired devices
        <span className="text-[11px] font-normal text-[var(--color-fg-mut)]">— currently trusted, with their scopes</span>
      </h2>
      {paired.length === 0 ? (
        <div className="mt-2 rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] p-4 text-[13px] text-[var(--color-fg-mut)]">
          No paired devices.
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          {paired.map((d) => {
            const isAdmin = d.scopes.includes("operator.admin");
            return (
              <div key={d.deviceId} className="rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[13px] text-[var(--color-fg)]">{d.deviceId.slice(0, 16)}…</span>
                  {d.role && <span className="rounded bg-[var(--color-line-2)] px-1.5 py-0.5 text-[9px] text-[var(--color-fg-mut)]">{d.role}</span>}
                  {d.clientId && <span className="text-[10px] text-[var(--color-fg-mut)]">{d.clientId}{d.platform ? ` · ${d.platform}` : ""}</span>}
                  <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold ${isAdmin ? "text-[var(--color-nv-bright)]" : "text-[#e0a800]"}`} style={{ border: `1px solid ${isAdmin ? "var(--color-nv-dim)" : "#e0a80055"}` }}>
                    {isAdmin ? "admin" : "pairing-only"}
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {d.scopes.map((s) => (
                    <span key={s} className={`rounded border px-1.5 py-0.5 font-mono text-[10px] ${s === "operator.admin" ? "border-[var(--color-nv-dim)] text-[var(--color-nv-bright)]" : "border-[var(--color-line-2)] text-[var(--color-fg-mut)]"}`}>{s}</span>
                  ))}
                  {age(d.lastSeenAtMs) && <span className="ml-1 self-center text-[10px] text-[var(--color-fg-mut)]">seen {age(d.lastSeenAtMs)} ago</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-4 text-[11px] text-[var(--color-fg-mut)]">
        A password-paired operator starts with only <code>operator.pairing</code> — it can ask to pair but can&apos;t <strong>approve</strong> anyone.{" "}
        <strong>Enable approvals</strong> grants it the admin scopes (one-time) and restarts the gateway. After that, a new device&apos;s pairing request shows up above and you <strong>Approve</strong>/<strong>Deny</strong> it (<code>openclaw devices</code> via <code>/api/devices</code>).
      </p>
    </div>
  );
}
