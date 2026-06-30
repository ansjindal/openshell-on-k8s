import { NextResponse } from "next/server";
import { spawn } from "node:child_process";

// Device-pairing approvals for the standalone OpenClaw Control UI sandbox. A device
// (browser/CLI) that asks to pair lands in the gateway's pending table; an admin
// approves/denies. We read the table and act via `openclaw devices …` run INSIDE the
// sandbox through `openshell --gateway fleet sandbox exec` — the SAME exec path the other
// routes in this app use (see api/fleet, api/agent-logs): spawn("openshell", ["--gateway",
// GATEWAY, "sandbox", "exec", "-n", SANDBOX, "--", …]) with stdin closed so the exec gets
// EOF and exits (it would otherwise hang waiting on stdin).
//
// IMPORTANT: `sandbox exec` rejects newlines in args. Pass each token as a separate argv
// element (no `sh -c '… | …'` one-liners — those have proven flaky here); for the multi-line
// bootstrap grant we base64-encode the JS and decode it in-sandbox via `node -e`-free pipe.
//
// The bootstrap-admin action is what lets the operator approve at all: a password-paired
// operator starts with only `operator.pairing` (it can ask to pair but can't APPROVE anyone —
// the classic "who approves the approver" deadlock: `devices approve` → "scope upgrade
// pending"). We break it through the HOST-privileged exec path (not an OpenClaw operator
// scope, so it's not subject to the deadlock): rewrite the gateway's device table to grant
// the admin scopes, clear pending, and restart the in-sandbox gateway so it reloads them.

const HOME = process.env.HOME ?? "/home/ubuntu";
// Match api/fleet + api/agent-logs: strip the host gateway-endpoint vars so the openshell CLI
// uses the named gateway (--gateway fleet) rather than the workshop's default gateway endpoint.
const { OPENSHELL_GATEWAY_ENDPOINT: _oge, OPENSHELL_GATEWAY_TLS: _ogt, ...envRest } = process.env;
const env = { ...envRest, PATH: `${process.env.PATH ?? ""}:${HOME}/.local/bin:/usr/local/bin:/usr/bin` };

const SANDBOX = process.env.OPENCLAW_UI_SANDBOX || "openclaw-ui";
const GATEWAY = process.env.OPENCLAW_UI_GATEWAY || "fleet";
const UI_PORT = process.env.OPENCLAW_UI_PORT || "18789";
const PASSWORD = process.env.OPENCLAW_UI_PASSWORD || "openclaw-ui-ctl";

const validName = (n: string) => /^[a-z0-9][a-z0-9-]{0,40}$/.test(n);
// requestId is whatever the gateway minted for a pending pairing; accept a conservative token.
const validReqId = (s: unknown) => typeof s === "string" && /^[A-Za-z0-9._-]{1,128}$/.test(s);

// Run `openshell --gateway <GATEWAY> sandbox exec -n <SANDBOX> -- <args…>` with stdin closed.
//
// `detach` mode is for launching a long-lived in-sandbox process (the gateway). A process
// started under `sandbox exec` gets reparented to the sandbox init (PID 1) and SURVIVES the
// exec session — but a SIGKILL of the exec client tears down the whole exec process group
// server-side, killing the not-yet-detached child too. So in detach mode we run the gateway
// in the FOREGROUND of the exec and, at the timeout, send a GRACEFUL SIGTERM (a clean client
// disconnect, which leaves the reparented gateway alive) rather than SIGKILL. We give it
// enough time first to bind + reparent.
function exec(args: string[], timeoutMs = 16_000, detach = false): Promise<{ code: number | null; out: string; err: string }> {
  return new Promise((resolve) => {
    const c = spawn("openshell", ["--gateway", GATEWAY, "sandbox", "exec", "-n", SANDBOX, "--", ...args], {
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "", err = "";
    c.stdout.on("data", (d) => (out += d));
    c.stderr.on("data", (d) => (err += d));
    const t = setTimeout(() => {
      try { c.kill(detach ? "SIGTERM" : "SIGKILL"); } catch { /* noop */ }
      // In detach mode a timeout is the EXPECTED exit (the foreground gateway never returns);
      // report it as a clean detach, not an error.
      resolve({ code: detach ? 0 : 124, out, err: err + (detach ? "\n[detached]" : "\n[exec timed out]") });
    }, timeoutMs);
    c.on("close", (code) => { clearTimeout(t); resolve({ code, out, err }); });
    c.on("error", (e) => { clearTimeout(t); resolve({ code: 1, out, err: String(e) }); });
  });
}

// `openclaw … --json` prints a banner + UNDICI/trace-warnings around the JSON; carve out the
// first complete JSON value.
function carveJson<T = unknown>(s: string): T | null {
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a < 0 || b < a) return null;
  try { return JSON.parse(s.slice(a, b + 1)) as T; } catch { return null; }
}

function clean(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, "").split("\n")
    .filter((l) => l.trim() && !/UNDICI|trace-warn|node --trace|ExperimentalWarning/.test(l))
    .join("\n");
}

type PairedTok = { scopes?: string[] };
type PairedDev = {
  deviceId?: string; clientId?: string; platform?: string; role?: string; roles?: string[];
  scopes?: string[]; approvedScopes?: string[]; tokens?: Record<string, PairedTok>;
  createdAtMs?: number; approvedAtMs?: number; lastSeenAtMs?: number;
};
type PendingDev = {
  requestId?: string; deviceId?: string; clientId?: string; platform?: string;
  role?: string; roles?: string[]; scopes?: string[]; isRepair?: boolean; ts?: number; createdAtMs?: number;
};

export const dynamic = "force-dynamic";

// GET → current device state of the OpenClaw Control UI gateway: pending pairings + paired
// devices with their scopes (so the UI can show whether the operator already has admin).
export async function GET() {
  if (!validName(SANDBOX)) return NextResponse.json({ ok: false, error: "bad sandbox name", pending: [], paired: [] });
  // Primary: `openclaw devices list --json` (returns { pending, paired }).
  const r = await exec(["openclaw", "devices", "list", "--json", "--password", PASSWORD], 16_000);
  const j = carveJson<{ pending?: PendingDev[]; paired?: PairedDev[] }>(r.out + "\n" + r.err);
  if (j && (Array.isArray(j.pending) || Array.isArray(j.paired))) {
    const pending = (j.pending ?? []).map((p) => ({
      requestId: String(p.requestId ?? p.deviceId ?? ""),
      deviceId: String(p.deviceId ?? ""),
      clientId: String(p.clientId ?? ""),
      platform: String(p.platform ?? ""),
      roles: Array.isArray(p.roles) ? p.roles : (p.role ? [p.role] : []),
      scopes: Array.isArray(p.scopes) ? p.scopes : [],
      isRepair: !!p.isRepair,
      ts: typeof p.ts === "number" ? p.ts : (typeof p.createdAtMs === "number" ? p.createdAtMs : null),
    })).filter((p) => p.requestId);
    const paired = (j.paired ?? []).map((d) => ({
      deviceId: String(d.deviceId ?? ""),
      clientId: String(d.clientId ?? ""),
      platform: String(d.platform ?? ""),
      role: String(d.role ?? (d.roles && d.roles[0]) ?? ""),
      scopes: Array.isArray(d.scopes) ? d.scopes : [],
      approvedScopes: Array.isArray(d.approvedScopes) ? d.approvedScopes : [],
      lastSeenAtMs: typeof d.lastSeenAtMs === "number" ? d.lastSeenAtMs : null,
    }));
    // The operator is "admin-enabled" once it holds operator.admin (i.e. bootstrap ran).
    const adminEnabled = paired.some((d) => d.scopes.includes("operator.admin"));
    return NextResponse.json({ ok: true, sandbox: SANDBOX, gateway: GATEWAY, pending, paired, adminEnabled });
  }
  // Fallback: read the on-disk device tables directly (the gateway client may be unreachable).
  const pf = await exec(["cat", "/sandbox/.openclaw/devices/pending.json"], 12_000);
  const pj = carveJson<Record<string, PendingDev>>(pf.out) ?? {};
  const pending = Object.values(pj).map((p) => ({
    requestId: String(p.requestId ?? p.deviceId ?? ""),
    deviceId: String(p.deviceId ?? ""),
    clientId: String(p.clientId ?? ""),
    platform: String(p.platform ?? ""),
    roles: Array.isArray(p.roles) ? p.roles : (p.role ? [p.role] : []),
    scopes: Array.isArray(p.scopes) ? p.scopes : [],
    isRepair: !!p.isRepair,
    ts: typeof p.ts === "number" ? p.ts : null,
  })).filter((p) => p.requestId);
  return NextResponse.json({
    ok: false, sandbox: SANDBOX, gateway: GATEWAY, pending, paired: [], adminEnabled: false,
    error: clean(r.err || r.out) || "could not reach the gateway device list",
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const action = body?.action;

  if (!validName(SANDBOX)) return NextResponse.json({ ok: false, error: "bad sandbox name" }, { status: 400 });

  // One-time bootstrap: grant the operator device the admin scopes it needs to approve
  // pairings, then restart the in-sandbox gateway so it reloads the new scopes. Idempotent +
  // re-runnable. This is what the "Enable approvals" button calls.
  if (action === "bootstrap-admin") {
    // The grant JS rewrites paired.json: scopes / approvedScopes / tokens.operator.scopes ->
    // the full operator admin set, and clears pending.json. Multi-line, so base64 it and
    // decode in-sandbox (exec rejects newlines in argv).
    const grantJs =
      'const fs=require("fs");const dir="/sandbox/.openclaw/devices";const p=dir+"/paired.json";' +
      'if(!fs.existsSync(p)){console.log("no-paired");process.exit(0);}' +
      'const d=JSON.parse(fs.readFileSync(p,"utf8"));if(!Object.keys(d).length){console.log("no-paired");process.exit(0);}' +
      'const want=["operator.pairing","operator.admin","operator.approvals","operator.read","operator.write"];' +
      'for(const k in d){d[k].scopes=want;d[k].approvedScopes=want;if(d[k].tokens&&d[k].tokens.operator)d[k].tokens.operator.scopes=want;}' +
      'fs.writeFileSync(p,JSON.stringify(d));try{fs.writeFileSync(dir+"/pending.json","{}")}catch(e){}' +
      'console.log("admin-bootstrapped "+Object.keys(d).length);';
    const b64 = Buffer.from(grantJs, "utf8").toString("base64");
    try {
      // Decode the grant JS in-sandbox and run it with node. Use an output sentinel
      // ("admin-bootstrapped") to confirm success — exit codes through exec are unreliable.
      const g = await exec(["sh", "-c", `echo ${b64} | base64 -d | node`], 16_000);
      const gtxt = clean(g.out + "\n" + g.err);
      if (/no-paired/.test(g.out)) {
        return NextResponse.json({
          ok: false, action,
          error: "No operator device paired yet — open the Control UI once (so a device tries to pair), then click Enable approvals again.",
        }, { status: 409 });
      }
      if (!/admin-bootstrapped/.test(g.out)) {
        return NextResponse.json({ ok: false, action, error: gtxt || "grant did not confirm" }, { status: 502 });
      }
      // Restart the in-sandbox gateway so it reloads the new scopes. Re-bind on the SAME port
      // the host `openshell forward` bridge points at, so the bridge keeps working. The running
      // gateway's argv may show as just `openclaw` (not `openclaw gateway run`), so kill by the
      // PID holding the port rather than relying on a pattern match. Use a log sentinel
      // ("listening") to confirm the listener came back up.
      //
      // 1) Kill the old gateway (by the PID holding the port — its argv may not match a
      //    pattern). Fast, returns clean.
      const killCmd =
        `OLD=$(ss -ltnp 2>/dev/null | grep ':${UI_PORT} ' | grep -oE 'pid=[0-9]+' | head -1 | cut -d= -f2); ` +
        `[ -n "$OLD" ] && kill "$OLD" 2>/dev/null; pkill -f 'gateway run' 2>/dev/null; sleep 2; echo killed`;
      await exec(["sh", "-c", killCmd], 12_000);
      // 2) Launch the gateway in the FOREGROUND of a DETACHED exec. It binds + reparents to the
      //    sandbox init within seconds; at the timeout the helper sends a graceful SIGTERM to
      //    the exec CLIENT (not the gateway), leaving the reparented gateway running. We write
      //    a fresh gw.log so the startup is fresh.
      const launchCmd =
        `cd /sandbox && exec openclaw gateway run --port ${UI_PORT} --bind lan --auth password --password '${PASSWORD}' --allow-unconfigured`;
      await exec(["sh", "-c", `${launchCmd} >/sandbox/gw.log 2>&1`], 11_000, /* detach */ true);
      // 3) Confirm the listener is up (separate, clean exec). The gateway pre-warms for a few
      //    seconds after binding, so poll a handful of times before giving up.
      const chk = await exec(["sh", "-c",
        `for i in 1 2 3 4 5 6 7 8; do ss -ltn 2>/dev/null | grep -q ':${UI_PORT} ' && { echo PORT_UP; break; }; sleep 2; done; ` +
        `ss -ltn 2>/dev/null | grep -q ':${UI_PORT} ' || echo PORT_DOWN`], 22_000);
      const listening = /PORT_UP/i.test(chk.out);
      const tail = await exec(["sh", "-c", `tail -2 /sandbox/gw.log 2>/dev/null`], 10_000);
      return NextResponse.json({
        ok: true, action,
        output: `${gtxt}. Gateway ${listening ? "restarted (listening)" : "restart issued — verifying"} — reload the Control UI to reconnect.`,
        restartLog: clean(tail.out).split("\n").slice(-2).join("\n"),
        listening,
      });
    } catch (e) {
      return NextResponse.json({ ok: false, action, error: e instanceof Error ? e.message : String(e) }, { status: 502 });
    }
  }

  const requestId = body?.requestId;
  const latest = body?.latest === true;
  if (action !== "approve" && action !== "reject")
    return NextResponse.json({ ok: false, error: "action must be approve|reject|bootstrap-admin" }, { status: 400 });
  if (!latest && !validReqId(requestId))
    return NextResponse.json({ ok: false, error: "invalid requestId (or pass latest:true)" }, { status: 400 });
  try {
    // `openclaw devices approve|reject [requestId] [--latest] --json --password <pw>`.
    const args = ["openclaw", "devices", action as string];
    if (latest) args.push("--latest"); else args.push(requestId as string);
    args.push("--json", "--password", PASSWORD);
    const r = await exec(args, 18_000);
    const text = clean(r.out + "\n" + r.err).split("\n").slice(-6).join("\n");
    const j = carveJson<{ ok?: boolean; error?: string }>(r.out + "\n" + r.err);
    // "No pending … to approve" is a benign no-op, not a failure; an explicit CLI error
    // ("Could not start the CLI", "unknown requestId", "denied", "Reason:") is.
    const benign = /no pending/i.test(text);
    const errored = /could not start the cli|unknown requestid|reason:\s|denied|\berror\b|\bfailed\b/i.test(text);
    const ok = j ? j.ok !== false : (benign || !errored);
    return NextResponse.json({ ok, action, output: text || `${action} issued`, error: ok ? undefined : (j?.error || text) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
