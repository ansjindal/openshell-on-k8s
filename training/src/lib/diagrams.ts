// Specs for <LiveDiagram>: boxes and arrows, each tagged with the layer (lab
// step) that adds it. Layer 0 is always drawn. `until` hides an element once a
// later layer replaces it (e.g. a rotated credential).
//
// Layers name the step behind them (`step: "<section>.<step>"`). Elements with
// `dyn` fill their text from that step's saved output, so the diagram shows
// what YOUR commands found (node name, pod states, versions, ids). Without an
// output, or if parsing fails, the textbook text stays.
export type Out = (layer: number) => string | undefined;
export type DNode = {
  id: string; x: number; y: number; w: number; h: number; label: string; sub?: string;
  layer: number; until?: number; kind?: "group" | "ext" | "deny" | "accent";
  dyn?: (out: Out) => Partial<Pick<DNode, "label" | "sub">> | undefined;
  live?: boolean;
  /** an icon from docs/src's set, e.g. "i-chip" */
  icon?: string;
  /** dashed outline: something that may exist (more sandboxes, …) */
  dashed?: boolean;
  /** shown when the box is clicked in a <Fig> */
  info?: string;
};
export type DEdge = {
  from: string; to: string; label?: string; layer: number; until?: number; kind?: "ok" | "deny" | "dash"; dx?: number; dy?: number;
  dyn?: (out: Out) => string | undefined;
};
export type Diagram = {
  title: string; w: number; h: number;
  layers: { n: number; name: string; note?: string; step?: string }[];
  nodes: DNode[]; edges: DEdge[];
};

// ---- small parsers for CLI / kubectl output ------------------------------
const lines = (s?: string) => (s ?? "").split("\n").map((l) => l.replace(/\s+$/, "")).filter(Boolean);
/** kubectl/openshell tables: header row + rows split on 2+ spaces. */
function table(s?: string): Record<string, string>[] {
  const ls = lines(s);
  const hi = ls.findIndex((l) => /^NAME\s{2,}/.test(l) || /^VERSION\s{2,}/.test(l));
  if (hi < 0) return [];
  const head = ls[hi].trim().split(/\s{2,}/);
  const rows: Record<string, string>[] = [];
  for (const l of ls.slice(hi + 1)) {
    if (/^(NAME|VERSION)\s{2,}/.test(l) || /^(==|Fleet|Scaling)/.test(l) || /^\s/.test(l)) break;
    const cols = l.trim().split(/\s{2,}/);
    rows.push(Object.fromEntries(head.map((h, i) => [h, cols[i] ?? ""])));
  }
  return rows;
}
/** "Key: value" lines (openshell status / whoami / policy get). */
function kv(s?: string): Record<string, string> {
  const o: Record<string, string> = {};
  for (const l of lines(s)) { const m = /^\s*([A-Za-z][\w ]*?):\s+(.*)$/.exec(l); if (m) o[m[1].trim()] = m[2].trim(); }
  return o;
}
const row = (s: string | undefined, prefix: string) => table(s).find((r) => (r.NAME ?? "").startsWith(prefix));
const short = (s: string, n = 22) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
const ageSec = (a = "") => { const m = /^(\d+)([smhd])/.exec(a); return m ? +m[1] * ({ s: 1, m: 60, h: 3600, d: 86400 } as Record<string, number>)[m[2]] : 1e9; };
const httpCode = (s?: string) => /HTTP (\d{3})/.exec(s ?? "")?.[1];

export const DIAGRAMS: Record<string, Diagram> = {
  deploy: {
    title: "Your lab VM, piece by piece",
    w: 960, h: 410,
    layers: [
      { n: 0, name: "You" },
      { n: 1, step: "1.1", name: "Node", note: "One k3s node, Ready: a full Kubernetes API on one VM. The frame shows your node's name and version." },
      { n: 2, step: "2.1", name: "Control plane", note: "Namespace openshell: the gateway (StatefulSet, SQLite), the Console (oauth2-proxy + backend) and the skill registry, with the states your command saw." },
      { n: 3, step: "3.1", name: "Gateway reachable", note: "The CLI reaches the gateway on NodePort 30808 over TLS, with a client certificate." },
      { n: 4, step: "3.2", name: "Your identity", note: "The certificate says OU=operator: the gateway treats this shell as a platform admin. People in the browser sign in with Keycloak instead." },
      { n: 5, step: "4.1", name: "Sandbox agent-0", note: "A sandbox is two pods in its workspace's namespace (openshell-lab-default): the workload (the agent) and its supervisor, which the gateway starts." },
      { n: 6, step: "5.1", name: "Models & sign-in", note: "LiteLLM serves the model to sandboxes through their supervisor; Keycloak signs people in." },
    ],
    nodes: [
      { id: "you", x: 20, y: 160, w: 170, h: 80, label: "You", sub: "Run ▷ · Cluster shell", layer: 0 },
      { id: "k3s", x: 215, y: 15, w: 730, h: 385, label: "k3s node · v1.37 · Ready", layer: 1, kind: "group",
        dyn: (o) => { const r = table(o(1))[0]; return r ? { label: `k3s node ${r.NAME} · ${r.VERSION} · ${r.STATUS}` } : undefined; } },
      { id: "nsos", x: 235, y: 45, w: 255, h: 340, label: "namespace openshell", layer: 2, kind: "group" },
      { id: "gw", x: 250, y: 80, w: 225, h: 70, label: "openshell-0", sub: "OpenShell gateway 0.1.7\nStatefulSet · SQLite", layer: 2, kind: "accent",
        dyn: (o) => { const r = row(o(2), "openshell-0"); const v = kv(o(3)).Version; return r ? { sub: `gateway ${v ?? ""} · StatefulSet\n${r.READY} ${r.STATUS} · ${r.AGE}` } : undefined; } },
      { id: "con", x: 250, y: 175, w: 225, h: 70, label: "openshell-dashboard", sub: "the Console\noauth2-proxy + backend", layer: 2,
        dyn: (o) => { const r = row(o(2), "openshell-dashboard"); return r ? { label: short(r.NAME, 26), sub: `the Console\n${r.READY} ${r.STATUS} · ${r.AGE}` } : undefined; } },
      { id: "reg", x: 250, y: 270, w: 225, h: 60, label: "registry", sub: "skill registry", layer: 2,
        dyn: (o) => { const r = row(o(2), "registry"); return r ? { sub: `skill registry · ${r.READY} ${r.STATUS}` } : undefined; } },
      { id: "id", x: 20, y: 275, w: 170, h: 80, label: "lab-operator", sub: "OU=operator\nplatform admin", layer: 4, kind: "accent",
        dyn: (o) => { const k = kv(o(4)); return k.Subject ? { label: k.Subject, sub: `roles: ${k.Roles || "-"}\nvia ${k.Provider || "-"}` } : undefined; } },
      { id: "nssb", x: 510, y: 45, w: 205, h: 200, label: "namespace openshell-lab-default", layer: 5, kind: "group" },
      { id: "wl", x: 525, y: 80, w: 175, h: 60, label: "agent-0", sub: "workload · Ready", layer: 5,
        dyn: (o) => { const rs = table(o(5)); if (!rs.length) return; const r = rs[0]; return { label: r.NAME, sub: `workload · ${r.PHASE}${rs.length > 1 ? ` · +${rs.length - 1} more` : ""}` }; } },
      { id: "sup", x: 525, y: 165, w: 175, h: 60, label: "os-supervisor-…", sub: "supervisor", layer: 5, kind: "accent" },
      { id: "ll", x: 735, y: 80, w: 195, h: 65, label: "LiteLLM", sub: "ns litellm · :4000", layer: 6, kind: "ext",
        dyn: (o) => { const r = row(o(6), "litellm"); return r ? { sub: `ns litellm · ${r.READY} ${r.STATUS}` } : undefined; } },
      { id: "kc", x: 735, y: 300, w: 195, h: 65, label: "Keycloak", sub: "ns keycloak · sign-in", layer: 6, kind: "ext",
        dyn: (o) => { const r = row(o(6), "keycloak"); return r ? { sub: `ns keycloak · ${r.READY} ${r.STATUS}` } : undefined; } },
    ],
    edges: [
      { from: "you", to: "gw", label: "TLS :30808", layer: 3, kind: "ok", dx: -62, dy: -42,
        dyn: (o) => { const k = kv(o(3)); return k.Status ? `:30808 · ${k.Status}` : undefined; } },
      { from: "gw", to: "sup", label: "starts", layer: 5, kind: "dash" },
      { from: "sup", to: "ll", label: "model calls", layer: 6, kind: "ok", dx: 70, dy: 42 },
    ],
  },

  "create-sandbox": {
    title: "What one `sandbox create` does",
    w: 960, h: 410,
    layers: [
      { n: 0, name: "Before" },
      { n: 1, step: "1.2", name: "agent-1 created", note: "The gateway stored agent-1 and its policy (revision 1), started a supervisor pod, and the workload pod came up Ready, in the workspace's namespace." },
      { n: 2, step: "3.1", name: "Sandbox resource", note: "Behind the workload pod is a Sandbox custom resource. The agent-sandbox controller reconciles it into the pod, like a Deployment does for ReplicaSets." },
      { n: 3, step: "3.2", name: "The boundary", note: "Labels pair each workload with its supervisor (the same id on both); a NetworkPolicy lets the workload talk to its supervisor and nothing else." },
    ],
    nodes: [
      { id: "you", x: 15, y: 150, w: 150, h: 75, label: "You", sub: "fleet / openshell", layer: 0 },
      { id: "gw", x: 230, y: 150, w: 195, h: 75, label: "OpenShell gateway", sub: "ns openshell", layer: 0, kind: "accent" },
      { id: "ns", x: 470, y: 15, w: 475, h: 385, label: "namespace openshell-lab-default", layer: 0, kind: "group" },
      { id: "a0", x: 490, y: 325, w: 210, h: 55, label: "agent-0", sub: "+ its supervisor (already there)", layer: 0 },
      { id: "store", x: 230, y: 275, w: 195, h: 80, label: "agent-1 · policy v1", sub: "stored by the gateway\nprovider: litellm", layer: 1,
        dyn: (o) => { const rs = table(o(1)).filter((r) => r.PHASE); const n = rs.sort((a, b) => (a.CREATED < b.CREATED ? 1 : -1))[0]; return n ? { label: `${n.NAME} · policy v1`, sub: `stored by the gateway\ncreated ${n.CREATED.slice(11)}` } : undefined; } },
      { id: "sup1", x: 490, y: 55, w: 210, h: 75, label: "os-supervisor-6db4…", sub: "supervisor pod\npolicy · credentials", layer: 1, kind: "accent",
        dyn: (o) => { const s = table(o(1)).filter((r) => r.NAME.startsWith("os-supervisor-") && r.STATUS).sort((a, b) => ageSec(a.AGE) - ageSec(b.AGE))[0]; return s ? { label: short(s.NAME, 24), sub: `supervisor pod\n${s.STATUS} · ${s.AGE}` } : undefined; } },
      { id: "wl1", x: 740, y: 55, w: 190, h: 75, label: "agent-1", sub: "workload pod · Ready", layer: 1,
        dyn: (o) => { const n = table(o(1)).filter((r) => r.PHASE).sort((a, b) => (a.CREATED < b.CREATED ? 1 : -1))[0]; return n ? { label: n.NAME, sub: `workload pod · ${n.PHASE}` } : undefined; } },
      { id: "cr", x: 490, y: 195, w: 210, h: 75, label: "Sandbox CR", sub: "agent-1\nagents.x-k8s.io", layer: 2,
        dyn: (o) => { const r = table(o(2)).sort((a, b) => ageSec(a.AGE) - ageSec(b.AGE))[0]; return r ? { sub: `${r.NAME} · READY ${r.READY}\n${r.REASON}` } : undefined; } },
      { id: "ctrl", x: 740, y: 195, w: 190, h: 75, label: "agent-sandbox", sub: "controller\nreconciles CR → pod", layer: 2 },
    ],
    edges: [
      { from: "you", to: "gw", layer: 1, kind: "ok" },
      { from: "gw", to: "store", label: "stores", layer: 1, kind: "dash" },
      { from: "gw", to: "sup1", label: "starts", layer: 1, kind: "ok" },
      { from: "gw", to: "cr", label: "writes", layer: 2, kind: "ok" },
      { from: "cr", to: "ctrl", layer: 2, kind: "dash" },
      { from: "ctrl", to: "wl1", label: "creates", layer: 2, kind: "ok" },
      { from: "sup1", to: "wl1", label: "only peer · NetworkPolicy", layer: 3, kind: "ok", dy: 52,
        dyn: (o) => { const w = table(o(3)).find((r) => r["BOUNDARY-ROLE"] === "workload"); return w ? `pair ${w["BOUNDARY-PAIR"].slice(0, 8)} · NetworkPolicy` : undefined; } },
    ],
  },

  policy: {
    title: "agent-0's network, rule by rule",
    w: 960, h: 400,
    layers: [
      { n: 0, name: "The sandbox" },
      { n: 1, step: "1.1", name: "Policy v1", note: "Every sandbox has a policy with a version and a hash; the supervisor enforces the loaded revision." },
      { n: 2, step: "1.2", name: "Provider rule", note: "The litellm provider added _provider_litellm: one endpoint with L7 rules (model calls only)." },
      { n: 3, step: "2.1", name: "Denied", note: "api.github.com has no rule, so the supervisor refused the connection." },
      { n: 4, step: "3.1", name: "Policy v2", note: "policy update added allow_api_github_com_443 (read-only, rest, enforce) and loaded it into the running sandbox." },
      { n: 5, step: "3.2", name: "GET allowed", note: "GET /zen matches the read-only preset." },
      { n: 6, step: "3.3", name: "POST refused", note: "POST /markdown is not GET/HEAD/OPTIONS: refused at L7 with 403 policy_denied, before it leaves the sandbox." },
      { n: 7, step: "4.1", name: "Revisions", note: "Every change is a numbered revision." },
    ],
    nodes: [
      { id: "wl", x: 20, y: 150, w: 180, h: 75, label: "workload pod", sub: "agent-0 · user sandbox", layer: 0 },
      { id: "sup", x: 280, y: 150, w: 195, h: 75, label: "supervisor pod", sub: "checks every request", layer: 0, kind: "accent" },
      { id: "pol", x: 280, y: 285, w: 195, h: 80, label: "policy v1", sub: "deny by default\nLoaded", layer: 1, until: 4,
        dyn: (o) => { const k = kv(o(1)); return k.Version ? { label: `policy v${k.Version}`, sub: `${k.Status || "loaded"}\nhash ${(k.Hash || "").slice(0, 12)}` } : undefined; } },
      { id: "pol2", x: 280, y: 285, w: 195, h: 80, label: "policy v2", sub: "+ allow_api_github_com_443\nread-only · rest · enforce", layer: 4,
        dyn: (o) => { const m = /version (\d+) loaded/i.exec(o(4) ?? ""); return m ? { label: `policy v${m[1]}`, sub: "+ allow_api_github_com_443\nloaded, no restart" } : undefined; } },
      { id: "ll", x: 640, y: 30, w: 290, h: 70, label: "LiteLLM :4000", sub: "_provider_litellm · 6 L7 rules", layer: 2, kind: "ext",
        dyn: (o) => { const s = o(2); if (!s) return; const i = s.indexOf("_provider_litellm:"); if (i < 0) return; const block = s.slice(i).split(/\n {2}\S/)[0]; const n = (block.match(/- allow:/g) || []).length; return n ? { sub: `_provider_litellm · ${n} L7 rules` } : undefined; } },
      { id: "gh", x: 640, y: 150, w: 290, h: 75, label: "api.github.com:443", sub: "no rule", layer: 3, until: 4 },
      { id: "gh2", x: 640, y: 150, w: 290, h: 75, label: "api.github.com:443", sub: "allow_api_github_com_443", layer: 4, kind: "ext",
        dyn: (o) => { const t = lines(o(5))[0]; return t ? { sub: short(t.replace(/\s*HTTP \d{3}$/, ""), 38) } : undefined; } },
      { id: "deny", x: 640, y: 285, w: 290, h: 65, label: "403 policy_denied", sub: "layer l7 · rule POST /markdown", layer: 6, kind: "deny",
        dyn: (o) => { const s = o(6); const c = httpCode(s); const l = /"layer":"(\w+)"/.exec(s ?? "")?.[1]; return c ? { label: `${c} policy_denied`, sub: `layer ${l ?? "l7"} · POST /markdown` } : undefined; } },
      { id: "rev", x: 20, y: 285, w: 180, h: 80, label: "revisions", sub: "v2 Loaded\nv1 Superseded", layer: 7,
        dyn: (o) => { const rs = table(o(7)); return rs.length ? { sub: rs.slice(0, 3).map((r) => `v${r.VERSION} ${r.STATUS}`).join("\n") } : undefined; } },
    ],
    edges: [
      { from: "wl", to: "sup", label: "all traffic", layer: 0, kind: "dash" },
      { from: "pol", to: "sup", label: "enforces", layer: 1, until: 4, kind: "dash", dx: 40 },
      { from: "pol2", to: "sup", label: "enforces", layer: 4, kind: "dash", dx: 40 },
      { from: "sup", to: "ll", label: "POST /v1/chat/completions", layer: 2, kind: "ok" },
      { from: "sup", to: "gh", label: "HTTP 000", layer: 3, until: 4, kind: "deny", dyn: (o) => { const c = httpCode(o(3)); return c ? `HTTP ${c}` : undefined; } },
      { from: "sup", to: "gh2", label: "GET /zen → 200", layer: 5, kind: "ok", dyn: (o) => { const c = httpCode(o(5)); return c ? `GET /zen → ${c}` : undefined; } },
      { from: "sup", to: "deny", label: "POST /markdown", layer: 6, kind: "deny" },
      { from: "rev", to: "pol2", layer: 7, kind: "dash" },
    ],
  },

  providers: {
    title: "A credential the agent never holds",
    w: 960, h: 400,
    layers: [
      { n: 0, name: "Sandbox + gateway" },
      { n: 1, step: "1.1", name: "Echo API", note: "An in-cluster service that echoes the headers it receives: it shows what really leaves the sandbox." },
      { n: 2, step: "2.2", name: "Profile", note: "The profile echo-api: which variable (ECHO_TOKEN), how it is sent (bearer) and where it may go (GET /api/** on echo:8080)." },
      { n: 3, step: "3.1", name: "Provider", note: "The provider echo holds the real token in the gateway." },
      { n: 4, step: "4.1", name: "Attached", note: "Attached to agent-0 live: the supervisor receives the credential and the profile's policy entry. No restart." },
      { n: 5, step: "4.2", name: "Placeholder", note: "New processes in the sandbox see a placeholder in ECHO_TOKEN, never the token." },
      { n: 6, step: "5.1", name: "GET carries the token", note: "The agent sent the placeholder; the supervisor swapped in the real token because the request matched the profile." },
      { n: 7, step: "5.2", name: "POST refused", note: "POST is not in the profile's rules: 403, and the token never leaves." },
      { n: 8, step: "6.1", name: "Rotated", note: "provider update replaced the value in the gateway; every attached sandbox picks it up, still without a restart." },
      { n: 9, step: "6.2", name: "New value", note: "The next request carries the new token. The agent's placeholder did not change." },
      { n: 10, step: "7.1", name: "Detached", note: "Detaching removes the credential and the policy entry from the sandbox." },
    ],
    nodes: [
      { id: "wl", x: 20, y: 40, w: 200, h: 75, label: "workload · agent-0", sub: "the agent", layer: 0 },
      { id: "sup", x: 340, y: 40, w: 190, h: 75, label: "supervisor", sub: "agent-0", layer: 0, kind: "accent" },
      { id: "gw", x: 340, y: 265, w: 190, h: 100, label: "OpenShell gateway", sub: "profiles · providers", layer: 0, kind: "accent" },
      { id: "echo", x: 680, y: 40, w: 255, h: 75, label: "echo API", sub: "lab-demo · :8080", layer: 1, kind: "ext",
        dyn: (o) => (/successfully rolled out/.test(o(1) ?? "") ? { sub: "lab-demo · :8080 · rolled out" } : undefined) },
      { id: "prof", x: 20, y: 265, w: 210, h: 100, label: "profile echo-api", sub: "ECHO_TOKEN · bearer\nGET /api/** only", layer: 2,
        dyn: (o) => (/Imported \d+ provider profile/.test(o(2) ?? "") ? { sub: "ECHO_TOKEN · bearer\nGET /api/** · imported" } : undefined) },
      { id: "cred", x: 680, y: 265, w: 255, h: 100, label: "provider echo", sub: "ECHO_TOKEN=lab-secret-123\nkept in the gateway", layer: 3, until: 8 },
      { id: "cred2", x: 680, y: 265, w: 255, h: 100, label: "provider echo", sub: "ECHO_TOKEN=lab-secret-456\nrotated, no restart", layer: 8 },
      { id: "ph", x: 20, y: 145, w: 200, h: 60, label: "$ECHO_TOKEN", sub: "openshell:resolve:env:…", layer: 5, until: 10, kind: "accent",
        dyn: (o) => { const v = lines(o(5)).find((l) => l.startsWith("openshell:resolve")); return v ? { sub: short(v, 28) } : undefined; } },
      { id: "deny", x: 680, y: 150, w: 255, h: 65, label: "POST /api/x", sub: "403 · not in the profile", layer: 7, kind: "deny",
        dyn: (o) => { const c = httpCode(o(7)); return c ? { sub: `${c} · not in the profile` } : undefined; } },
    ],
    edges: [
      { from: "wl", to: "sup", label: "all traffic", layer: 0, until: 6, kind: "dash" },
      { from: "prof", to: "gw", label: "import", layer: 2, kind: "ok" },
      { from: "gw", to: "cred", label: "stores", layer: 3, until: 8, kind: "dash" },
      { from: "gw", to: "cred2", label: "stores", layer: 8, kind: "dash" },
      { from: "gw", to: "sup", label: "credential + rule", layer: 4, until: 10, kind: "ok", dx: 60 },
      { from: "wl", to: "sup", label: "placeholder", layer: 6, kind: "ok" },
      { from: "sup", to: "echo", label: "Bearer lab-secret-123", layer: 6, until: 9, kind: "ok",
        dyn: (o) => /"authorization": "(Bearer [^"]+)"/.exec(o(6) ?? "")?.[1] },
      { from: "sup", to: "echo", label: "Bearer lab-secret-456", layer: 9, kind: "ok",
        dyn: (o) => /"authorization": "(Bearer [^"]+)"/.exec(o(9) ?? "")?.[1] },
      { from: "sup", to: "deny", label: "POST", layer: 7, kind: "deny" },
    ],
  },

  audit: {
    title: "Where every decision goes",
    w: 960, h: 430,
    layers: [
      { n: 0, name: "The sandbox" },
      { n: 1, step: "1.1", name: "Denied traffic", note: "Two refusals: example.org (no rule, not even resolved) and LiteLLM's admin API (L7)." },
      { n: 2, step: "1.2", name: "OCSF in the CLI", note: "The supervisor writes one OCSF event per decision: class, ALLOWED/DENIED, binary, target, policy and reason." },
      { n: 3, step: "2.1", name: "Loki", note: "Alloy ships the supervisor's log to Loki: the same events for every sandbox in every workspace namespace, queryable with LogQL." },
      { n: 4, step: "3.1", name: "Grafana", note: "Grafana Explore on Loki: {namespace=~\"openshell-lab-.+\", container=\"supervisor\"} |= \"DENIED\"." },
      { n: 5, step: "3.2", name: "Live", note: "In Live mode a new denial shows up within seconds." },
    ],
    nodes: [
      { id: "wl", x: 20, y: 60, w: 180, h: 70, label: "workload · agent-0", sub: "curl", layer: 0 },
      { id: "sup", x: 270, y: 60, w: 195, h: 70, label: "supervisor", sub: "decides, then logs", layer: 0, kind: "accent" },
      { id: "org", x: 600, y: 15, w: 220, h: 60, label: "example.org", sub: "DENIED · no rule", layer: 1, kind: "deny" },
      { id: "adm", x: 600, y: 100, w: 220, h: 60, label: "LiteLLM /key/generate", sub: "DENIED · L7", layer: 1, kind: "deny" },
      { id: "cli", x: 270, y: 225, w: 195, h: 85, label: "openshell logs", sub: "OCSF NET:… HTTP:…\nALLOWED / DENIED", layer: 2,
        dyn: (o) => { const ls = lines(o(2)).filter((l) => l.includes("OCSF")); if (!ls.length) return; const d = ls.filter((l) => l.includes("DENIED")).length; const a = ls.filter((l) => l.includes("ALLOWED")).length; return { sub: `${ls.length} OCSF events\n${d} DENIED · ${a} ALLOWED` }; } },
      { id: "alloy", x: 520, y: 225, w: 160, h: 70, label: "Alloy", sub: "ships pod logs", layer: 3 },
      { id: "loki", x: 740, y: 225, w: 195, h: 70, label: "Loki", sub: "container=supervisor", layer: 3, kind: "ext",
        dyn: (o) => { const n = lines(o(3)).filter((l) => l.includes("DENIED")).length; return n ? { sub: `${n} denials found` } : undefined; } },
      { id: "graf", x: 740, y: 345, w: 195, h: 70, label: "Grafana Explore", sub: "|= \"DENIED\"", layer: 4, kind: "ext" },
      { id: "live", x: 520, y: 345, w: 160, h: 70, label: "Live", sub: "seconds later", layer: 5, kind: "accent" },
    ],
    edges: [
      { from: "wl", to: "sup", layer: 0, kind: "dash" },
      { from: "sup", to: "org", layer: 1, kind: "deny" },
      { from: "sup", to: "adm", layer: 1, kind: "deny" },
      { from: "sup", to: "cli", label: "OCSF events", layer: 2, kind: "ok" },
      { from: "sup", to: "alloy", label: "pod log", layer: 3, kind: "ok" },
      { from: "alloy", to: "loki", layer: 3, kind: "ok" },
      { from: "loki", to: "graf", label: "LogQL", layer: 4, kind: "ok" },
      { from: "graf", to: "live", layer: 5, kind: "dash" },
    ],
  },

  // ---- the platform, one layer per card (Overview page, The big picture)
  platform: {
    title: "The platform, layer by layer",
    w: 600, h: 470,
    layers: [{ n: 0, name: "" }, { n: 1, name: "One VM" }, { n: 2, name: "The gateway" }, { n: 3, name: "A sandbox" }, { n: 4, name: "Models" }, { n: 5, name: "People" }, { n: 6, name: "Audit" }],
    nodes: [
      { id: "vm", x: 10, y: 10, w: 580, h: 450, label: "Brev VM · k3s, one Kubernetes node", layer: 1, kind: "group" },
      { id: "gw", x: 30, y: 45, w: 210, h: 60, label: "OpenShell gateway", sub: "sandboxes · policies · keys", layer: 2, kind: "accent" },
      { id: "you", x: 370, y: 45, w: 200, h: 60, label: "You", sub: "openshell CLI (mTLS)", layer: 2 },
      { id: "ns", x: 30, y: 130, w: 540, h: 150, label: "namespace openshell-lab-default · workspace default", layer: 3, kind: "group" },
      { id: "wl", x: 45, y: 165, w: 200, h: 60, label: "workload pod", sub: "the agent, sealed in", layer: 3 },
      { id: "sup", x: 355, y: 165, w: 200, h: 60, label: "supervisor pod", sub: "policy · keys · audit", layer: 3, kind: "accent" },
      { id: "ll", x: 30, y: 310, w: 170, h: 56, label: "LiteLLM → model", sub: "real key added", layer: 4, kind: "ext" },
      { id: "net", x: 215, y: 310, w: 170, h: 56, label: "everything else", sub: "denied by default", layer: 3, kind: "deny" },
      { id: "loki", x: 400, y: 310, w: 170, h: 56, label: "Loki · Grafana", sub: "every allow and deny", layer: 6, kind: "ext" },
      { id: "kc", x: 30, y: 390, w: 250, h: 56, label: "Keycloak", sub: "people sign in, get a role", layer: 5, kind: "ext" },
      { id: "con", x: 320, y: 390, w: 250, h: 56, label: "OpenShell Console", sub: "the same gateway, in a browser", layer: 5, kind: "ext" },
    ],
    edges: [
      { from: "you", to: "gw", label: "create", layer: 2, kind: "ok" },
      { from: "gw", to: "sup", label: "creates", layer: 3, kind: "ok", dx: -95, dy: -14 },
      { from: "wl", to: "sup", label: "only way out", layer: 3, kind: "dash" },
      { from: "sup", to: "net", layer: 3, kind: "deny" },
      { from: "sup", to: "ll", label: "allowed calls", layer: 4, kind: "ok", dx: -40, dy: 6 },
      { from: "sup", to: "loki", label: "OCSF", layer: 6, kind: "dash", dx: 22 },
      { from: "kc", to: "con", label: "sign-in", layer: 5, kind: "ok" },
    ],
  },
  // ---- 0.3 Your cluster and the model: one layer per command
  "cluster-tour": {
    title: "Your cluster, as your commands find it",
    w: 960, h: 500,
    layers: [
      { n: 0, name: "You" },
      { n: 1, step: "1.1", name: "The node", note: "One k3s node, in two halves: the control plane (the API server and friends) decides, the worker side (kubelet, containerd) runs the pods, one namespace per component. kubectl talks to the API server." },
      { n: 2, step: "2.1", name: "LiteLLM", note: "One Deployment behind one Service, reachable only inside the cluster at litellm.litellm.svc.cluster.local:4000." },
      { n: 3, step: "2.2", name: "Its configuration", note: "LiteLLM's model list: your inference endpoint and model, under the alias default. The upstream key comes from a Secret." },
      { n: 4, step: "3.1", name: "A call", note: "A port-forward from the VM to the Service, LiteLLM's master key, and an answer from your model." },
    ],
    nodes: [
      { id: "you", icon: "i-term", x: 15, y: 170, w: 170, h: 80, label: "You", sub: "kubectl · Cluster shell", layer: 0 },
      { id: "k3s", icon: "i-wheel", x: 205, y: 12, w: 745, h: 478, label: "k3s node · v1.37 · Ready", layer: 1, kind: "group",
        dyn: (o) => { const r = table(o(1))[0]; return r ? { label: `k3s node ${short(r.NAME, 24)} · ${r.VERSION} · ${r.STATUS}` } : undefined; } },
      { id: "cp", x: 220, y: 40, w: 715, h: 90, label: "control plane", layer: 1, kind: "group" },
      { id: "api", icon: "i-svc", x: 232, y: 66, w: 172, h: 50, label: "kube-apiserver", sub: "the cluster's API", layer: 1, kind: "accent" },
      { id: "db", icon: "i-db", x: 414, y: 66, w: 160, h: 50, label: "datastore", sub: "SQLite (kine)", layer: 1 },
      { id: "sch", icon: "i-gear", x: 584, y: 66, w: 160, h: 50, label: "scheduler", sub: "places pods", layer: 1 },
      { id: "cm", icon: "i-sync", x: 754, y: 66, w: 170, h: 50, label: "controllers", sub: "keep it as declared", layer: 1 },
      { id: "wk", icon: "i-cube", x: 220, y: 144, w: 715, h: 332, label: "worker · kubelet + containerd run the pods", layer: 1, kind: "group" },
      ...((SUBS) => ([
        ["ll", "litellm", ["litellm"], 470, 172, "ext", "i-chip"],
        ["mon", "monitoring", ["monitoring"], 232, 172, undefined, "i-chart"],
        ["kc", "keycloak", ["keycloak"], 705, 172, undefined, "i-people"],
        ["env", "envoy-gateway-system", ["envoy-gateway-system"], 232, 226, undefined, "i-route"],
        ["demo", "demo", ["demo"], 470, 226, undefined, "i-svc"],
        ["ks", "kube-system", ["kube-system"], 705, 226, undefined, "i-gear"],
        ["cm2", "cert-manager · kyverno", ["cert-manager", "kyverno"], 232, 280, undefined, "i-cert"],
        ["os", "openshell + sandboxes", ["openshell", "openshell-lab-default", "openshell-lab-team-a", "agent-sandbox-system"], 470, 280, undefined, "i-shield"],
        ["ag", "agents", ["agents"], 705, 280, undefined, "i-bot"],
      ] as [string, string, string[], number, number, DNode["kind"], string][]).map(([id, label, names, x, y, kind, icon]): DNode => ({
        id, x, y, w: 218, h: 46, label, icon, sub: SUBS[id], layer: 1, kind,
      })))({ ll: "the model gateway", mon: "metrics · logs · traces", kc: "sign-in for people", env: "routes web traffic", demo: "a small shop app", ks: "DNS · metrics", cm2: "certificates · admission", os: "Module 1", ag: "empty until 0.4" } as Record<string, string>),
      { id: "dep", icon: "i-chip", x: 232, y: 352, w: 218, h: 108, label: "deploy/litellm", sub: "svc/litellm · ClusterIP\n:4000, in-cluster only", layer: 2, kind: "ext",
        dyn: (o) => {
          const t = o(2) ?? ""; const d = /deployment\.apps\/litellm\s+(\S+)/.exec(t); const sv = /service\/litellm\s+(\S+)\s+(\S+)\s+\S+\s+(\S+)/.exec(t);
          return d || sv ? { sub: `${d ? d[1] + " ready" : ""}\nsvc ${sv ? sv[1] + " " + sv[2] : ""}\n${sv ? sv[3] : ""}` } : undefined;
        } },
      { id: "cfg", icon: "i-doc", x: 470, y: 352, w: 218, h: 108, label: "model_list", sub: "your model\nalias: default\nkey from a Secret", layer: 3,
        dyn: (o) => { const m = /model:\s*openai\/(\S+)/.exec(o(3) ?? ""); return m ? { sub: `${short(m[1], 26)}\nalias: default\nkey from a Secret` } : undefined; } },
      { id: "ans", icon: "i-bot", x: 705, y: 352, w: 218, h: 108, label: "the answer", sub: "\"Hello, I hope\nyou're well.\"", layer: 4, kind: "accent",
        dyn: (o) => {
          const m = /"content":"((?:[^"\\]|\\.)*)"/.exec(o(4) ?? ""); if (!m) return;
          const a = m[1].replace(/\\n/g, " ").replace(/\\"/g, '"').trim();
          return { sub: `"${short(a, 26)}${a.length > 26 ? "" : ""}"\n${a.length > 26 ? short(a.slice(25), 26) : ""}` };
        } },
      { id: "up", icon: "i-globe", x: 15, y: 330, w: 170, h: 80, label: "model API", sub: "your inference\nendpoint", layer: 3, kind: "ext" },
    ],
    edges: [
      { from: "you", to: "api", label: "kubectl", layer: 1, kind: "ok", dy: -4 },
      { from: "ll", to: "dep", layer: 2, kind: "dash" },
      { from: "dep", to: "up", label: "HTTPS", layer: 3, kind: "ok" },
      { from: "you", to: "dep", label: "port-forward", layer: 4, kind: "ok", dx: -22, dy: -6 },
      { from: "dep", to: "ans", layer: 4, kind: "ok" },
    ],
  },
  // ---- module overviews (ScrollBuild): one layer per lesson, 600 wide so the
  // diagram fills the sticky panel beside the cards.
  m1: {
    title: "Module 1: from a cluster to a sealed sandbox",
    w: 600, h: 465,
    layers: [{ n: 0, name: "You" }, { n: 1, name: "Verify the cluster" }, { n: 2, name: "Build an agent" }, { n: 3, name: "Create a sandbox" }, { n: 4, name: "Into the sandbox" }, { n: 5, name: "Egress policy" }, { n: 6, name: "TCP egress" }],
    nodes: [
      { id: "you", x: 10, y: 20, w: 150, h: 56, label: "You", sub: "operator CLI · mTLS", layer: 0 },
      { id: "gw", x: 190, y: 20, w: 190, h: 56, label: "OpenShell gateway", sub: "openshell-0 · 0.1.7", layer: 1, kind: "accent" },
      { id: "pol", x: 400, y: 20, w: 190, h: 56, label: "policy v2", sub: "deny by default + 1 rule", layer: 5 },
      { id: "ns", x: 10, y: 100, w: 580, h: 170, label: "namespace openshell-lab-default", layer: 3, kind: "group" },
      { id: "wl", x: 25, y: 132, w: 210, h: 64, label: "agent-0 · workload pod", sub: "the agent", layer: 3 },
      { id: "seal", x: 25, y: 206, w: 210, h: 52, label: "sealed in", sub: "Landlock · seccomp", layer: 4 },
      { id: "sup", x: 390, y: 132, w: 185, h: 64, label: "supervisor pod", sub: "owns the network", layer: 3, kind: "accent" },
      { id: "gh", x: 10, y: 310, w: 180, h: 62, label: "api.github.com", sub: "GET ✓ · POST 403 (L7)", layer: 5, kind: "ext" },
      { id: "tcp", x: 210, y: 310, w: 180, h: 62, label: "example.com:443", sub: "L4 · curl only", layer: 6, kind: "ext" },
      { id: "pi", x: 10, y: 395, w: 580, h: 56, label: "pi on the VM, unsandboxed", sub: "your real key in its environment · reaches any host", layer: 2, kind: "deny", dashed: true },
      { id: "deny", x: 410, y: 310, w: 180, h: 62, label: "everything else", sub: "refused + logged", layer: 3, kind: "deny" },
    ],
    edges: [
      { from: "you", to: "gw", layer: 1, kind: "ok" },
      { from: "gw", to: "sup", layer: 3, kind: "ok" },
      { from: "wl", to: "sup", label: "the only way out", layer: 4, kind: "dash" },
      { from: "pol", to: "sup", label: "live", layer: 5, kind: "ok", dx: 18 },
      { from: "sup", to: "gh", layer: 5, kind: "ok" },
      { from: "sup", to: "tcp", layer: 6, kind: "ok" },
      { from: "sup", to: "deny", layer: 3, kind: "deny" },
    ],
  },
  m2: {
    title: "Module 2: a model, keys it never sees, skills, a task",
    w: 600, h: 370,
    layers: [{ n: 0, name: "The sandbox" }, { n: 1, name: "Models through a provider" }, { n: 2, name: "Your own provider" }, { n: 3, name: "Workspace files" }, { n: 4, name: "Skills" }, { n: 5, name: "Run a task" }],
    nodes: [
      { id: "wl", x: 10, y: 20, w: 200, h: 80, label: "agent-0", sub: "LITELLM_API_KEY =\nopenshell:resolve:env:…", layer: 0 },
      { id: "soul", x: 230, y: 30, w: 140, h: 62, label: "SOUL.md", sub: "workspace files", layer: 3 },
      { id: "sup", x: 10, y: 160, w: 200, h: 72, label: "supervisor pod", sub: "real key on allowed\ncalls only", layer: 0, kind: "accent" },
      { id: "ll", x: 400, y: 20, w: 190, h: 62, label: "LiteLLM → model", sub: "provider litellm", layer: 1, kind: "ext" },
      { id: "echo", x: 400, y: 115, w: 190, h: 62, label: "echo-api", sub: "your profile · rotate", layer: 2, kind: "ext" },
      { id: "reg", x: 400, y: 210, w: 190, h: 62, label: "skill registry", sub: "npm · scoped policy", layer: 4, kind: "ext" },
      { id: "task", x: 10, y: 290, w: 200, h: 62, label: "a task", sub: "prompt → tools → answer", layer: 5, kind: "accent" },
    ],
    edges: [
      { from: "wl", to: "sup", layer: 0, kind: "dash" },
      { from: "soul", to: "wl", layer: 3, kind: "dash" },
      { from: "sup", to: "ll", label: "real key", layer: 1, kind: "ok", dx: 20 },
      { from: "sup", to: "echo", label: "real token", layer: 2, kind: "ok", dx: 30 },
      { from: "sup", to: "reg", label: "npm install", layer: 4, kind: "ok", dx: 30, dy: 14 },
      { from: "task", to: "sup", layer: 5, kind: "ok" },
    ],
  },
  m3: {
    title: "Module 3: who did what, and who may",
    w: 600, h: 370,
    layers: [{ n: 0, name: "The gateway" }, { n: 1, name: "The audit trail" }, { n: 2, name: "The Console" }, { n: 3, name: "Users, roles & workspaces" }],
    nodes: [
      { id: "sup", x: 10, y: 20, w: 170, h: 62, label: "supervisors", sub: "OCSF per decision", layer: 1 },
      { id: "loki", x: 420, y: 20, w: 170, h: 62, label: "Loki · Grafana", sub: "ALLOWED / DENIED", layer: 1, kind: "ext" },
      { id: "con", x: 10, y: 150, w: 170, h: 70, label: "OpenShell Console", sub: "sandboxes · logs\nterminal", layer: 2, kind: "ext" },
      { id: "gw", x: 215, y: 150, w: 175, h: 70, label: "OpenShell gateway", sub: "one API, CLI and web", layer: 0, kind: "accent" },
      { id: "kc", x: 10, y: 290, w: 170, h: 62, label: "Keycloak", sub: "demo · learner", layer: 3, kind: "ext" },
      { id: "wsA", x: 420, y: 120, w: 170, h: 62, label: "workspace default", sub: "openshell-lab-default", layer: 3 },
      { id: "wsB", x: 420, y: 210, w: 170, h: 70, label: "workspace team-a", sub: "openshell-lab-team-a\nlearner is a member", layer: 3 },
    ],
    edges: [
      { from: "sup", to: "loki", label: "Alloy", layer: 1, kind: "ok" },
      { from: "con", to: "gw", label: "your token", layer: 2, kind: "ok" },
      { from: "kc", to: "con", label: "sign-in", layer: 3, kind: "ok", dx: 30 },
      { from: "gw", to: "wsA", layer: 3, kind: "ok" },
      { from: "gw", to: "wsB", layer: 3, kind: "ok" },
    ],
  },
  m4: {
    title: "Module 4: a fleet of sealed specialists",
    w: 600, h: 390,
    layers: [{ n: 0, name: "You, the SRE" }, { n: 1, name: "The challenge" }, { n: 2, name: "Spin up the fleet" }, { n: 3, name: "Fleet status" }, { n: 4, name: "Investigate" }, { n: 5, name: "Under the hood" }, { n: 6, name: "Build your own" }],
    nodes: [
      { id: "you", x: 10, y: 20, w: 150, h: 56, label: "You · SRE", sub: "approve the fix", layer: 0 },
      { id: "an", x: 215, y: 20, w: 170, h: 56, label: "analyst", sub: "plans · combines", layer: 2, kind: "accent" },
      { id: "svc", x: 420, y: 20, w: 170, h: 56, label: "incident-desk", sub: "payments → 0 replicas", layer: 1, kind: "deny" },
      { id: "logs", x: 10, y: 130, w: 138, h: 56, label: "logs", sub: "Loki · read-only", layer: 2 },
      { id: "met", x: 158, y: 130, w: 138, h: 56, label: "metrics", sub: "Prometheus", layer: 2 },
      { id: "tr", x: 306, y: 130, w: 138, h: 56, label: "traces", sub: "Tempo", layer: 2 },
      { id: "ev", x: 454, y: 130, w: 136, h: 56, label: "events", sub: "kube events", layer: 2 },
      { id: "st", x: 10, y: 230, w: 180, h: 56, label: "fleet status", sub: "Ready · egress · SOUL", layer: 3 },
      { id: "rc", x: 210, y: 230, w: 180, h: 56, label: "root cause", sub: "scaled to 0 → you fix it", layer: 4, kind: "accent" },
      { id: "orch", x: 410, y: 230, w: 180, h: 56, label: "orchestrator", sub: "plan · probe · synthesise", layer: 5 },
      { id: "new", x: 210, y: 320, w: 180, h: 56, label: "your agent", sub: "+ persona · skill · policy", layer: 6, dashed: true },
    ],
    edges: [
      { from: "you", to: "an", label: "fleet task", layer: 2, kind: "ok" },
      { from: "an", to: "logs", layer: 2, kind: "dash" }, { from: "an", to: "met", layer: 2, kind: "dash" },
      { from: "an", to: "tr", layer: 2, kind: "dash" }, { from: "an", to: "ev", layer: 2, kind: "dash" },
      { from: "met", to: "rc", label: "evidence", layer: 4, kind: "ok", dx: 26 },
    ],
  },
};
