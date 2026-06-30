/**
 * GatewayClient — the SINGLE seam between this app and the OpenShell gateway.
 *
 * Everything else in the backend is auth-agnostic and talks to this interface.
 * The CLI implementation below shells out to `openshell` (the verified, supported
 * interface on the cluster: sandbox create/exec/delete + policy update/get).
 *
 * AUTH (to finalize once we have OIDC issuer + client-credentials):
 *   The gateway enforces OIDC. A headless service can't use `openshell gateway login`
 *   (browser flow), so we obtain a client-credentials bearer token from OIDC_ISSUER
 *   and present it to the gateway. Depending on what the CLI accepts non-interactively
 *   we either (a) seed the token into the CLI's gateway registration, or (b) call the
 *   gateway gRPC directly. `ensureToken()` is where that lands.
 */
import { spawn } from "node:child_process";
import { ensureCliToken } from "./auth.js";

export interface EgressEvent {
  agent: string;
  decision: "allow" | "deny";
  host: string;
  port?: number;
  reason?: string;
  ts: string;
}

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface GatewayClient {
  createSandbox(name: string): Promise<void>;
  /** Block until the sandbox reports Phase: Ready (fresh sandboxes aren't immediately execable). */
  waitReady(name: string, timeoutSec?: number): Promise<void>;
  deleteSandbox(name: string): Promise<void>;
  /** Apply an allowlisted egress endpoint in enforce mode (the L7 proxy denies the rest). */
  policyAddEndpoint(name: string, endpoint: string): Promise<void>;
  policyAddAllow(name: string, rule: string): Promise<void>;
  /** Atomic policy edit: endpoint + allow paths in ONE `policy update` (avoids the add-endpoint→
   *  add-allow race where the allow lands before the endpoint exists and is dropped). */
  policyUpdate(name: string, opts: { removeEndpoint?: string; addEndpoint?: string; addAllow?: string[] }): Promise<void>;
  /** Remove an endpoint (host:port) and its allow rules — used to reset before a posture hot-reload. */
  policyRemoveEndpoint(name: string, hostPort: string): Promise<void>;
  /** Policy change history for a sandbox (`openshell policy list`) — the live change audit. */
  policyList(name: string): Promise<string>;
  /** Poll until the sandbox reports its latest policy as effective (best-effort). */
  policyWaitEffective(name: string, timeoutSec?: number): Promise<void>;
  exec(name: string, command: string[], opts?: ExecOpts): Promise<ExecResult>;
  /** Recent sandbox logs (bounded — the CLI may stream). */
  logs(name: string): Promise<string>;
  /** The gateway's effective policy for a sandbox (`openshell policy get`). */
  policyGet(name: string): Promise<string>;
  /** Run a (possibly multi-line) script in the sandbox. base64-wrapped because exec args
   *  may not contain newlines. */
  execScript(name: string, script: string, opts?: ExecOpts): Promise<ExecResult>;
}

export interface ExecOpts {
  timeoutSec?: number;
  env?: Record<string, string>;
  input?: string;
}

const ENDPOINT = process.env.OPENSHELL_GATEWAY_ENDPOINT ?? "openshell.openshell.svc.cluster.local:8080";

// The gateway runs multiple replicas; a sandbox supervisor session lives on ONE replica, so
// some exec calls land on the wrong replica and fail transiently. Retry those.
const TRANSIENT = [
  "supervisor session not connected",
  "service is currently unavailable",
  "transport error",
  "tcp connect error",
];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Hard client-side timeout so a hung `openshell sandbox exec` (e.g. the exec stream landing on a
// gateway replica that doesn't hold the sandbox's supervisor session) can't stall the whole run.
const HARD_MS = Number(process.env.CLI_HARD_TIMEOUT_MS ?? 300_000);

function runOnce(args: string[], input?: string): Promise<ExecResult> {
  return new Promise((resolve) => {
    // Use --gateway-endpoint (direct) — the registered "-g <name>" path has a URL-scheme bug.
    // It still uses the token bundle auth.ts writes for the matching registered gateway.
    const child = spawn("openshell", ["--gateway-endpoint", `http://${ENDPOINT}`, "--gateway-insecure", ...args], {
      env: { ...process.env, OPENSHELL_NO_BROWSER: "1" },
    });
    let stdout = "", stderr = "", done = false;
    const finish = (r: ExecResult) => { if (done) return; done = true; clearTimeout(timer); resolve(r); };
    const timer = setTimeout(() => { try { child.kill("SIGKILL"); } catch { /* noop */ } finish({ stdout, stderr: stderr + " [client-timeout]", exitCode: -1 }); }, HARD_MS);
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    if (input) child.stdin.end(input);
    child.on("close", (code) => finish({ stdout, stderr, exitCode: code ?? -1 }));
    child.on("error", () => finish({ stdout, stderr: stderr + " [spawn-error]", exitCode: -1 }));
  });
}

/**
 * Run the openshell CLI against the REGISTERED OIDC gateway (by name) so it uses the
 * oidc_token.json bundle auth.ts writes. We must NOT pass --gateway-endpoint (it bypasses the
 * stored token). Retries on transient multi-replica relay errors.
 */
async function run(args: string[], input?: string): Promise<ExecResult> {
  const maxAttempts = 6;
  let last: ExecResult = { stdout: "", stderr: "", exitCode: -1 };
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    last = await runOnce(args, input);
    if (last.exitCode === 0) return last;
    const blob = (last.stderr + last.stdout).toLowerCase();
    if (!TRANSIENT.some((t) => blob.includes(t))) return last; // non-transient: don't retry
    await sleep(1500);
  }
  return last;
}

export class CliGatewayClient implements GatewayClient {
  async ensureToken(): Promise<void> {
    await ensureCliToken();
  }
  async createSandbox(name: string): Promise<void> {
    await this.ensureToken();
    const r = await run(["sandbox", "create", "--name", name, "--provider", process.env.SANDBOX_PROVIDER ?? "fleet"]);
    // `sandbox create` can print a benign post-step warning ("No such file or directory") yet still
    // create the sandbox; only fail on a clear gateway/auth error.
    const blob = (r.stderr + r.stdout).toLowerCase();
    if (r.exitCode !== 0 && /(unauthorized|missing authorization|forbidden|failed to connect|already exists)/.test(blob) && !blob.includes("already exists")) {
      throw new Error(`create ${name}: ${r.stderr || r.stdout}`);
    }
  }
  async waitReady(name: string, timeoutSec = 200): Promise<void> {
    await this.ensureToken();
    const deadline = Date.now() + timeoutSec * 1000;
    while (Date.now() < deadline) {
      const r = await run(["sandbox", "get", name]);
      if (/phase:\s*ready/i.test(r.stdout)) return;
      await sleep(4000);
    }
  }
  async logs(name: string): Promise<string> {
    await this.ensureToken();
    return new Promise((resolve) => {
      const child = spawn("openshell", ["--gateway-endpoint", `http://${ENDPOINT}`, "--gateway-insecure", "logs", name],
        { env: { ...process.env, OPENSHELL_NO_BROWSER: "1" } });
      let out = "";
      child.stdout.on("data", (d) => (out += d));
      child.stderr.on("data", (d) => (out += d));
      const t = setTimeout(() => { try { child.kill("SIGKILL"); } catch { /* noop */ } resolve(out); }, 12_000);
      child.on("close", () => { clearTimeout(t); resolve(out); });
      child.on("error", () => { clearTimeout(t); resolve(out); });
    });
  }
  async policyGet(name: string): Promise<string> {
    await this.ensureToken();
    const r = await run(["policy", "get", name]);
    return (r.stdout || r.stderr).trim();
  }
  async deleteSandbox(name: string): Promise<void> {
    await run(["sandbox", "delete", name]); // delete takes a positional name (not --name)
  }
  async policyAddEndpoint(name: string, endpoint: string): Promise<void> {
    await this.ensureToken();
    const r = await run(["policy", "update", name, "--add-endpoint", endpoint]);
    if (r.exitCode !== 0) throw new Error(`policy endpoint ${name}: ${r.stderr || r.stdout}`);
  }
  async policyAddAllow(name: string, rule: string): Promise<void> {
    await this.ensureToken();
    const r = await run(["policy", "update", name, "--add-allow", rule]);
    if (r.exitCode !== 0) throw new Error(`policy allow ${name}: ${r.stderr || r.stdout}`);
  }
  async policyUpdate(name: string, opts: { removeEndpoint?: string; addEndpoint?: string; addAllow?: string[] }): Promise<void> {
    await this.ensureToken();
    const args = ["policy", "update", name];
    if (opts.removeEndpoint) args.push("--remove-endpoint", opts.removeEndpoint);
    if (opts.addEndpoint) args.push("--add-endpoint", opts.addEndpoint);
    for (const a of opts.addAllow ?? []) args.push("--add-allow", a);
    const r = await run(args);
    if (r.exitCode !== 0 && !/not found|no such|unknown endpoint/i.test(r.stderr + r.stdout)) {
      throw new Error(`policy update ${name}: ${r.stderr || r.stdout}`);
    }
  }
  async policyRemoveEndpoint(name: string, hostPort: string): Promise<void> {
    await this.ensureToken();
    const r = await run(["policy", "update", name, "--remove-endpoint", hostPort]);
    // tolerate "not found" — first apply has nothing to remove
    if (r.exitCode !== 0 && !/not found|no such|unknown endpoint/i.test(r.stderr + r.stdout)) {
      throw new Error(`policy remove-endpoint ${name}: ${r.stderr || r.stdout}`);
    }
  }
  async policyList(name: string): Promise<string> {
    await this.ensureToken();
    const r = await run(["policy", "list", name]);
    return (r.stdout || r.stderr).trim();
  }
  async policyWaitEffective(name: string, timeoutSec = 20): Promise<void> {
    await this.ensureToken();
    const deadline = Date.now() + timeoutSec * 1000;
    while (Date.now() < deadline) {
      const r = await run(["policy", "get", name, "-o", "json"]);
      try { const j = JSON.parse(r.stdout); if (j.status === "effective" && j.active_version === j.version) { await sleep(1500); return; } } catch { /* keep polling */ }
      await sleep(2000);
    }
  }
  async exec(name: string, command: string[], opts: ExecOpts = {}): Promise<ExecResult> {
    await this.ensureToken();
    const envFlags: string[] = [];
    for (const [k, v] of Object.entries(opts.env ?? {})) envFlags.push("--env", `${k}=${v}`);
    return run([
      "sandbox", "exec", "-n", name,
      "--timeout", String(opts.timeoutSec ?? 120),
      ...envFlags,
      "--", ...command,
    ], opts.input);
  }
  async execScript(name: string, script: string, opts: ExecOpts = {}): Promise<ExecResult> {
    // Pipe the base64 script via STDIN (exec forwards stdin to the remote command) rather than as a
    // command arg — avoids any arg quoting/size pitfalls. Remote: `base64 -d | bash`.
    const b64 = Buffer.from(script, "utf8").toString("base64");
    return this.exec(name, ["bash", "-lc", "base64 -d | bash"], { ...opts, input: b64 });
  }
}
