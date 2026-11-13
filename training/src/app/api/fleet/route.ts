import { NextResponse } from "next/server";
import { spawn } from "node:child_process";

// Module 4 capstone: the fleet at a glance. For each agent: is it Ready, which hosts its
// policy reaches, which sre-tools MCP tools it may call, and its role (/sandbox/ROLE.md).

const HOME = process.env.HOME ?? "/home/ubuntu";
const { OPENSHELL_GATEWAY_ENDPOINT: _oge, OPENSHELL_GATEWAY_TLS: _ogt, ...envRest } = process.env;
const env = { ...envRest, PATH: `${process.env.PATH ?? ""}:${HOME}/.local/bin:/usr/local/bin:/usr/bin` };
const FLEET = (process.env.FLEET || "logs,metrics,traces,events,analyst").split(",").map((s) => s.trim()).filter(Boolean);
const ROLES: Record<string, string> = { logs: "Scout: logs (loki_query)", metrics: "Gauge: metrics (prometheus_query)", traces: "Trace: traces (tempo_search)", events: "Probe: Kubernetes (cluster_events, pod_status)", analyst: "Sage: lead analyst (no tools)" };

function openshell(args: string[], timeoutMs = 12_000): Promise<{ code: number | null; out: string }> {
  return new Promise((resolve) => {
    const c = spawn("openshell", ["--gateway", "fleet", ...args], { env, stdio: ["ignore", "pipe", "pipe"] });
    let out = ""; c.stdout.on("data", (d) => (out += d)); c.stderr.on("data", (d) => (out += d));
    const t = setTimeout(() => c.kill("SIGTERM"), timeoutMs);
    c.on("close", (code) => { clearTimeout(t); resolve({ code, out }); });
    c.on("error", () => { clearTimeout(t); resolve({ code: 1, out: "" }); });
  });
}

async function agentInfo(name: string) {
  // egress: parse the effective policy's network_policies endpoints
  const p = await openshell(["policy", "get", name, "--full", "-o", "json"]);
  const egress: string[] = []; const tools: string[] = []; let ready = false;
  try {
    const clean = p.out.split("\n").filter((l) => !/UNDICI|trace-warn/.test(l)).join("\n");
    const j = JSON.parse(clean.slice(clean.indexOf("{")));
    const nps = j.policy?.network_policies ?? {};
    for (const k of Object.keys(nps)) for (const e of nps[k].endpoints ?? []) {
      egress.push(`${e.host}:${e.port}`);
      // MCP endpoints: the tool names its allow rules name
      for (const r of e.rules ?? []) {
        const t = r.allow?.tool; const names = typeof t === "string" ? [t] : t?.any ?? [];
        tools.push(...names);
      }
    }
    ready = true; // policy fetch succeeded → the sandbox exists and the gateway knows it
  } catch { /* not found / not ready */ }
  // liveness + role: read the agent's ROLE.md. A successful read also proves the sandbox is
  // live, so this doubles as the liveness check.
  const soulPath = "/sandbox/ROLE.md";
  const sr = await openshell(["sandbox", "exec", "-n", name, "--", "cat", soulPath], 8000);
  const soul = sr.code === 0 ? sr.out.split("\n").filter((l) => !/UNDICI|trace-warn/.test(l)).join("\n").trim() : "";
  return { name, role: ROLES[name] ?? name, ready: ready && sr.code === 0, egress, tools, soul, soulPath };
}

export async function GET() {
  const agents = await Promise.all(FLEET.map(agentInfo));
  return NextResponse.json({ ok: true, agents });
}
