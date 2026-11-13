import { NextResponse } from "next/server";
import { spawn } from "node:child_process";

// Module 4 capstone, in the website: an orchestrator that gives each sealed specialist agent
// an investigation step (in parallel, via pi in its sandbox), then the analyst agent
// synthesizes their findings. The website never calls a model or a tool directly: each agent
// reaches LiteLLM through its `litellm` provider (the supervisor injects the key) and the
// sre-tools MCP server through its policy, which allows only that agent's tools. Streams a
// live timeline.

const HOME = process.env.HOME ?? "/home/ubuntu";
const KUBECONFIG = process.env.KUBECONFIG || `${HOME}/.kube/config`;
const { OPENSHELL_GATEWAY_ENDPOINT: _oge, OPENSHELL_GATEWAY_TLS: _ogt, ...envRest } = process.env;
const env = { ...envRest, NODE_NO_WARNINGS: "1", KUBECONFIG, PATH: `${process.env.PATH ?? ""}:${HOME}/.local/bin:/usr/local/bin:/usr/bin` };
const FLEET = (process.env.FLEET || "logs,metrics,traces,events,analyst").split(",").map((s) => s.trim()).filter(Boolean);

// What each specialist should ask its tool. Free-form investigation wanders and runs long, so
// the orchestrator names the tool call; the agent makes it (through the supervisor, which
// allows only that agent's tools) and interprets the result; the analyst synthesizes.
const NS = process.env.INCIDENT_NS || "demo";
const PROBES: Record<string, { call: string; hint: string }> = {
  metrics: { call: `prometheus_query("sum by (code) (rate(shop_requests_total{namespace=\"${NS}\"}[2m]))") and prometheus_query("kube_deployment_status_replicas_available{namespace=\"${NS}\"}")`,
    hint: "the shop's request rate by HTTP code (5xx is the error rate) and each Deployment's available replicas" },
  logs: { call: `loki_query("{namespace=\"${NS}\", app=\"shop-app\"} |= \"error\"", 30)`,
    hint: "the shop's recent error lines: what failed and which dependency" },
  events: { call: `cluster_events("${NS}") and pod_status("${NS}")`,
    hint: "what Kubernetes changed recently (a Deployment scaled, pods killed or failing) and which pods are missing or not ready" },
  traces: { call: `tempo_search("{ resource.service.name = \"shop\" && status = error }", 30)`,
    hint: "recent error traces of the shop: how many, which operation, how long" },
};
const PI = "pi --no-session --append-system-prompt /sandbox/ROLE.md";

// Run `openshell …` with stdin closed so `sandbox exec` gets EOF and exits.
function openshell(args: string[], timeoutMs = 180_000, signal?: AbortSignal): Promise<string> {
  return new Promise((resolve) => {
    // Pin the `fleet` gateway (the lab operator's mTLS registration) explicitly.
    // `signal` lets the route terminate this exec when the user stops the investigation
    // (client aborts the fetch → req.signal fires → Node kills the child).
    const c = spawn("openshell", ["--gateway", "fleet", ...args], { env, signal, stdio: ["ignore", "pipe", "pipe"] });
    let out = ""; c.stdout.on("data", (d) => (out += d)); c.stderr.on("data", (d) => (out += d));
    const t = setTimeout(() => c.kill("SIGTERM"), timeoutMs);
    c.on("close", () => { clearTimeout(t); resolve(out); });
    c.on("error", (e) => { clearTimeout(t); resolve(`(dispatch error: ${e.message})`); });
  });
}

async function runAgent(agent: string, subtask: string, signal?: AbortSignal, tools = true): Promise<string> {
  // `openshell sandbox exec` rejects args containing newlines, and prompts are multi-line,
  // so pass the prompt base64-encoded and decode it inside the sandbox.
  const b64 = Buffer.from(subtask, "utf8").toString("base64");
  const out = await openshell(["sandbox", "exec", "-n", agent, "--", "sh", "-c",
    `${PI}${tools ? "" : " --no-mcp --no-tools"} -p "$(printf %s ${b64} | base64 -d)"`], 180_000, signal);
  return out.split("\n").filter((l) => !/UNDICI|trace-warn/.test(l)).join("\n").trim().slice(0, 4000);
}

// Streams the run as newline-delimited JSON events so the UI shows a LIVE TIMELINE of each
// agent (start/done + duration) — and the long run never idles the connection out. The
// investigators run in PARALLEL; the writer agent synthesizes once they're all in.
export async function POST(req: Request) {
  const { task } = await req.json().catch(() => ({}));
  if (!task || typeof task !== "string") return NextResponse.json({ ok: false, error: "task required" }, { status: 400 });
  const SYNTH = "analyst";
  const investigators = FLEET.filter((a) => a !== SYNTH);

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const t0 = Date.now();
      const emit = (o: object) => { try { controller.enqueue(enc.encode(JSON.stringify({ t: Date.now() - t0, ...o }) + "\n")); } catch { /* connection gone */ } };
      // Heartbeat: the investigators run ~50s with NO bytes on the wire, which trips the
      // launchpad proxy's idle timeout (→ the browser sees a "network error" and every step
      // shows "interrupted"). Emit a ping every 10s so the stream never idles. The client
      // ignores unknown event types, so a ping is a harmless keep-alive.
      const hb = setInterval(() => emit({ type: "ping" }), 10_000);
      // Stop button → client aborts the fetch → req.signal fires here → kill the in-flight execs
      // (threaded into each spawn) and close the stream. The run does not proceed to synthesis.
      req.signal?.addEventListener("abort", () => { clearInterval(hb); try { controller.close(); } catch { /* already closed */ } });
      try {
        emit({ type: "plan-start", fleet: FLEET, investigators });
        // Fixed plan: one investigation step per specialist. No host-side model call to plan —
        // the intelligence is in each agent's investigation + the writer's synthesis (both reach
        // the model through their own `litellm` provider, so the website holds no model key).
        const steps: { agent: string; subtask: string; request: string }[] = investigators.map((a) => {
          const p = PROBES[a];
          // `request` is the tool call the agent will make, shown in the UI.
          const request = p ? p.call : "(no tool)";
          const subtask = p
            ? `Incident: ${task}\n\nInvestigate it in your role. Call your sre-tools tool exactly like this: ${p.call}. It returns ${p.hint}. Then report at most five bullets of concrete findings, each naming the tool and the values it returned, and STOP. No proposals, no greeting.`
            : `Incident: ${task}\n\nYou have no tool for this incident: say so in one line.`;
          return { agent: a, subtask, request };
        });
        emit({ type: "plan", steps });

        // dispatch investigators in PARALLEL; emit start now, done as each resolves
        steps.forEach((s) => emit({ type: "step", agent: s.agent, subtask: s.subtask, request: s.request, status: "start" }));
        const results = await Promise.all(steps.map(async (s) => {
          const st = Date.now();
          const out = await runAgent(s.agent, s.subtask, req.signal);
          emit({ type: "step", agent: s.agent, status: "done", out, ms: Date.now() - st });
          return { ...s, out };
        }));
        if (req.signal?.aborted) { try { controller.close(); } catch { /* */ } return; }

        // writer agent synthesizes
        const findings = results.map((r) => `## ${r.agent}\n${r.out}`).join("\n\n");
        emit({ type: "writer", status: "start" });
        const ws = Date.now();
        let answer = ""; let synthesizedBy = "analyst";
        if (FLEET.includes(SYNTH)) {
          const analystPrompt = `You are the incident analyst synthesizing an SRE fleet's findings. Reason ONLY over the findings below: do NOT use any tool, and do NOT greet, ask questions, or describe yourself. Begin your reply directly with "ROOT CAUSE:". In 2-4 sentences give the ROOT CAUSE citing the evidence (error rate, error logs naming the failing dependency, the failing span). CRITICAL: ask "what changed?" — the events findings name a recent change (a dependency scaled to 0, or a recent deploy) that coincides with when the errors began; THAT change is the root cause, and the fix is to REVERSE it specifically. If logs show calls to a dependency failing AND events show that dependency was scaled to 0, the cause is the dependency being down — recommend scaling it back up. Then, on a FINAL separate line, output exactly:\nRECOMMENDED_ACTION: <the specific reversal, e.g. "scale the payments deployment back up to restore the dependency" or "roll back the recent deploy">\n\nIncident: ${task}\n\nFindings:\n${findings}`;
          // the model occasionally emits a non-answer (a greeting / "who am I?"); accept only a
          // real synthesis (must carry the RECOMMENDED_ACTION line) and retry once otherwise.
          for (let attempt = 0; attempt < 2 && !answer && !req.signal?.aborted; attempt++) {
            const w = (await runAgent(SYNTH, analystPrompt, req.signal, false)).trim();
            if (w && !/^\(.*(failed|error)/i.test(w) && /RECOMMENDED_ACTION:/i.test(w)) answer = w;
          }
        }
        if (!answer) { answer = `_(writer agent unavailable — raw findings below)_\n\n${findings}`; synthesizedBy = "raw"; }
        emit({ type: "answer", answer, synthesizedBy, ms: Date.now() - ws });
        emit({ type: "done" });
      } catch (e) {
        emit({ type: "error", error: e instanceof Error ? e.message : String(e) });
      }
      clearInterval(hb);
      controller.close();
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson", "cache-control": "no-cache" } });
}

export async function GET() {
  return NextResponse.json({ ok: true, fleet: FLEET, hint: "POST { task } → streams plan → parallel agents → writer (NDJSON timeline)" });
}
