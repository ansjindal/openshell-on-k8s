/**
 * Gateway auth — mint an OIDC token from the cluster's Keycloak and hand it to the CLI.
 *
 * Discovered from the live cluster (defaults below; override via env):
 *   issuer    = https://openshell-demo-jbkjongmx.brevlab.com/auth/realms/openshell
 *   audience  = openshell-cli   (gateway checks aud == this)
 *   client    = openshell-cli   (the client the real CLI uses)
 *   roles_claim= realm_access.roles ; admin_role = openshell-admin
 * Keycloak supports `client_credentials` and `password` grants.
 *
 * The openshell CLI reads its token from an `oidc_token.json` bundle
 * { access_token, refresh_token, expires_at, issuer, client_id } in its gateway
 * registration dir. We register the gateway in OIDC mode once, then write that bundle
 * (refreshing before expiry). No browser needed (OPENSHELL_NO_BROWSER=1).
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const ISSUER = process.env.OIDC_ISSUER ?? "https://openshell-demo-jbkjongmx.brevlab.com/auth/realms/openshell";
const CLIENT_ID = process.env.OIDC_CLIENT_ID ?? "openshell-cli";
const AUDIENCE = process.env.OIDC_AUDIENCE ?? "openshell-cli";
const SCOPES = process.env.OIDC_SCOPES ?? "openid";
const GRANT = process.env.OIDC_GRANT ?? (process.env.OIDC_CLIENT_SECRET ? "client_credentials" : "password");
const ENDPOINT = process.env.OPENSHELL_GATEWAY_ENDPOINT ?? "openshell.openshell.svc.cluster.local:8080";
const GATEWAY_NAME = process.env.OPENSHELL_GATEWAY ?? "research-desk";
const CONFIG_HOME = process.env.OPENSHELL_CONFIG_HOME ?? join(homedir(), ".config", "openshell");

let tokenEndpoint: string | null = null;
let cached: { access_token: string; expiresAt: number; refresh_token?: string } | null = null;
let registered = false;

async function discover(): Promise<string> {
  if (tokenEndpoint) return tokenEndpoint;
  if (process.env.OIDC_TOKEN_ENDPOINT) return (tokenEndpoint = process.env.OIDC_TOKEN_ENDPOINT);
  const r = await fetch(`${ISSUER}/.well-known/openid-configuration`);
  if (!r.ok) throw new Error(`OIDC discovery failed: ${r.status}`);
  tokenEndpoint = (await r.json()).token_endpoint as string;
  return tokenEndpoint;
}

async function mint(): Promise<{ access_token: string; expires_in: number; refresh_token?: string }> {
  const body = new URLSearchParams({ client_id: CLIENT_ID, scope: SCOPES });
  if (GRANT === "client_credentials") {
    body.set("grant_type", "client_credentials");
    body.set("client_secret", required("OIDC_CLIENT_SECRET"));
    if (AUDIENCE) body.set("audience", AUDIENCE);
  } else {
    body.set("grant_type", "password");
    body.set("username", required("OIDC_USERNAME"));
    body.set("password", required("OIDC_PASSWORD"));
    if (process.env.OIDC_CLIENT_SECRET) body.set("client_secret", process.env.OIDC_CLIENT_SECRET);
  }
  const res = await fetch(await discover(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`token request failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<{ access_token: string; expires_in: number; refresh_token?: string }>;
}

function required(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`${key} not set (needed for OIDC ${GRANT} grant)`);
  return v;
}

/** Run an openshell CLI command async (never blocks the event loop). */
function sh(args: string[]): Promise<void> {
  return new Promise((resolve) => {
    const c = spawn("openshell", args, { env: { ...process.env, OPENSHELL_NO_BROWSER: "1" }, stdio: "ignore" });
    c.on("close", () => resolve());
    c.on("error", () => resolve());
  });
}

/**
 * Register the gateway (OIDC) once. `gateway add` creates the registration immediately, then waits
 * up to 120s for an interactive browser login that can't complete headless — we only need the
 * registration (the token comes from the bundle we write), so create it and don't wait for login.
 */
async function ensureRegistered(): Promise<void> {
  if (registered) return;
  await new Promise<void>((resolve) => {
    const c = spawn("openshell",
      ["gateway", "add", `http://${ENDPOINT}`, "--name", GATEWAY_NAME,
       "--oidc-issuer", ISSUER, "--oidc-client-id", CLIENT_ID, "--oidc-audience", AUDIENCE, "--gateway-insecure"],
      { env: { ...process.env, OPENSHELL_NO_BROWSER: "1" }, stdio: "ignore" });
    const t = setTimeout(() => { try { c.kill(); } catch { /* noop */ } resolve(); }, 6000);
    c.on("close", () => { clearTimeout(t); resolve(); });
    c.on("error", () => { clearTimeout(t); resolve(); });
  });
  registered = true;
}

/** Write the token bundle the CLI reads. */
function writeBundle(t: { access_token: string; expires_in: number; refresh_token?: string }): void {
  const dir = join(CONFIG_HOME, "gateways", GATEWAY_NAME);
  mkdirSync(dir, { recursive: true });
  const bundle = {
    access_token: t.access_token,
    refresh_token: t.refresh_token ?? "",
    expires_at: Date.now() + t.expires_in * 1000, // epoch ms
    issuer: ISSUER,
    client_id: CLIENT_ID,
  };
  writeFileSync(join(dir, "oidc_token.json"), JSON.stringify(bundle), { mode: 0o600 });
}

let inflight: Promise<void> | null = null;

/**
 * Ensure a fresh token is available to the CLI. Single-flight: parallel agents (4 workers at once)
 * must NOT concurrently `gateway add` + rewrite the same oidc_token.json — that races/corrupts the
 * bundle and breaks exec auth. Concurrent callers await the one in-flight setup.
 */
export async function ensureCliToken(): Promise<void> {
  if (cached && cached.expiresAt - Date.now() > 60_000) return;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      await ensureRegistered();
      if (cached && cached.expiresAt - Date.now() > 60_000) return;
      const t = await mint();
      cached = { access_token: t.access_token, refresh_token: t.refresh_token, expiresAt: Date.now() + t.expires_in * 1000 };
      writeBundle(t);
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}
