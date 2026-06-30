import "./tracing.js"; // must register the OTel provider before anything emits spans
import express from "express";
import { CliGatewayClient } from "./gateway.js";
import { Orchestrator } from "./orchestrator.js";
import { listIncidents, getIncident, getSource } from "./incidents.js";
import { telemetryConfig, litellmSummary, promQuery } from "./metrics.js";
import { appHealth } from "./liveEvidence.js";
import { listPods } from "./k8s.js";
import type { PolicyPosture } from "./types.js";

const app = express();
app.use(express.json());

const orch = new Orchestrator(new CliGatewayClient());

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.get("/api/incidents", (_req, res) => res.json(listIncidents()));
app.get("/api/incidents/:id", (req, res) => {
  const inc = getIncident(req.params.id);
  if (!inc) return res.status(404).json({ error: "not found" });
  res.json({ id: inc.id, title: inc.title, severity: inc.severity, symptoms: inc.symptoms, live: !!inc.live,
    remediation: inc.remediation ? { description: inc.remediation.description } : undefined,
    sources: inc.sources.map((s) => ({ kind: s.kind, label: s.label, hint: s.hint })) });
});
// Re-break a live incident so the fleet can solve it again.
app.post("/api/incidents/:id/trigger", async (req, res) => {
  try { res.json(await orch.triggerIncident(req.params.id)); }
  catch (e) { res.status(400).json({ error: String((e as Error).message) }); }
});

// --- Incident evidence (fetched by the SCOPED investigator sandboxes through the L7 policy proxy) ---
app.get("/incident/:id/:kind/raw", (req, res) => serveEvidence(req, res));
app.get("/incident/:id/:kind", (req, res) => serveEvidence(req, res));
function serveEvidence(req: express.Request, res: express.Response) {
  const s = getSource(req.params.id, req.params.kind);
  if (!s) return res.status(404).type("text/plain").send("no such evidence source");
  res.type("text/plain").send(`# ${s.label} — look for: ${s.hint}\n\n${s.body}\n`);
}

// --- Runs ---
app.post("/api/runs", (req, res) => {
  try {
    const run = orch.start({ incidentId: req.body?.incidentId, posture: req.body?.posture as PolicyPosture });
    res.json(run);
  } catch (e) { res.status(400).json({ error: String((e as Error).message) }); }
});
app.get("/api/autopilot", (_req, res) => res.json({ enabled: orch.getAutopilot() }));
app.post("/api/autopilot", (req, res) => { orch.setAutopilot(!!req.body?.enabled); res.json({ enabled: orch.getAutopilot() }); });
app.get("/api/runs", (_req, res) => res.json(orch.listRuns()));
app.get("/api/runs/:id", (req, res) => {
  const run = orch.get(req.params.id);
  if (!run) return res.status(404).json({ error: "not found" });
  res.json(run);
});
app.get("/api/runs/:id/stream", (req, res) => {
  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
  res.write(": connected\n\n");
  const unsubscribe = orch.subscribe(req.params.id, (e) => res.write(`data: ${JSON.stringify(e)}\n\n`));
  const ping = setInterval(() => res.write(": ping\n\n"), 20000);
  req.on("close", () => { clearInterval(ping); unsubscribe(); });
});
app.post("/api/runs/:id/approve", async (req, res) => {
  try { await orch.approve(req.params.id); res.json({ ok: true }); }
  catch (e) { res.status(400).json({ error: String((e as Error).message) }); }
});
app.post("/api/runs/:id/reject", (req, res) => { orch.reject(req.params.id); res.json({ ok: true }); });
// Human-approved REAL remediation: patch the live app config (only for live incidents).
app.post("/api/runs/:id/remediate", async (req, res) => {
  try { await orch.remediate(req.params.id, req.body?.option); res.json({ ok: true }); }
  catch (e) { res.status(400).json({ error: String((e as Error).message) }); }
});
app.post("/api/runs/:id/cancel", async (req, res) => {
  try { await orch.cancel(req.params.id); res.json({ ok: true }); }
  catch (e) { res.status(400).json({ error: String((e as Error).message) }); }
});
// Human-in-the-loop: re-task one investigator (after a hot-reload, or with a new hypothesis)
app.post("/api/runs/:id/redirect", async (req, res) => {
  try { await orch.redirect(req.params.id, req.body?.agent, req.body?.hypothesis); res.json({ ok: true }); }
  catch (e) { res.status(400).json({ error: String((e as Error).message) }); }
});
// Live policy hot-reload: change an investigator's (or all investigators') egress posture on the running sandbox
app.post("/api/runs/:id/policy", async (req, res) => {
  try {
    await orch.setPosture(req.params.id, req.body?.target ?? "all", req.body?.posture as PolicyPosture, req.body?.custom);
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: String((e as Error).message) }); }
});

// --- Per-agent introspection ---
app.get("/api/agents/:name/logs", async (req, res) => {
  try { res.type("text/plain").send((await orch.logs(req.params.name)).slice(-8000) || "(no logs)"); }
  catch (e) { res.status(500).send(String((e as Error).message)); }
});
app.get("/api/agents/:name/policy", async (req, res) => {
  try { res.type("text/plain").send(await orch.policy(req.params.name) || "(no policy)"); }
  catch (e) { res.status(500).send(String((e as Error).message)); }
});
app.get("/api/agents/:name/policy/history", async (req, res) => {
  try { res.type("text/plain").send(await orch.policyHistory(req.params.name) || "(no history)"); }
  catch (e) { res.status(500).send(String((e as Error).message)); }
});

// --- Telemetry ---
app.get("/api/telemetry/config", async (_req, res) => res.json(await telemetryConfig()));
app.get("/api/telemetry/litellm", async (_req, res) => res.json(await litellmSummary()));
app.get("/api/telemetry/query", async (req, res) => res.json({ result: await promQuery(String(req.query.q ?? "")) }));
// Live health of a live incident's app (metrics + recent error logs) — shown in the UI.
app.get("/api/live/app", async (req, res) => {
  try {
    const inc = getIncident(String(req.query.incident ?? "orders-pool"));
    if (!inc?.liveConfig) return res.status(404).json({ error: "not a live incident" });
    res.json(await appHealth(inc.liveConfig));
  } catch (e) { res.status(500).json({ error: String((e as Error).message) }); }
});
// `kubectl get pods` for the live incident's namespace.
app.get("/api/live/pods", async (req, res) => {
  try {
    const inc = getIncident(String(req.query.incident ?? "orders-pool"));
    if (!inc?.liveConfig) return res.status(404).json({ error: "not a live incident" });
    res.json({ namespace: inc.liveConfig.namespace, pods: await listPods(inc.liveConfig.namespace) });
  } catch (e) { res.status(500).json({ error: String((e as Error).message) }); }
});

const port = Number(process.env.PORT ?? 8080);
app.listen(port, () => console.log(`research-desk (RCA) backend on :${port}`));
