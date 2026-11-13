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
  from: string; to: string; label?: string; layer: number; until?: number; kind?: "ok" | "deny" | "dash" | "risk"; dx?: number; dy?: number;
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
      { n: 5, step: "4.1", name: "Sandbox agent-0", note: "A sandbox is two pods in its workspace's namespace (lab): the workload (the agent) and its supervisor, which the gateway starts." },
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
      { id: "nssb", x: 510, y: 45, w: 205, h: 200, label: "namespace lab", layer: 5, kind: "group" },
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
      { id: "ns", x: 470, y: 15, w: 475, h: 385, label: "namespace lab", layer: 0, kind: "group" },
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
      { n: 4, step: "3.1", name: "Grafana", note: "Grafana Explore on Loki: {namespace=~\"lab|dev|team-.+\", container=\"supervisor\"} |= \"DENIED\"." },
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
      { id: "ns", x: 30, y: 130, w: 540, h: 150, label: "namespace lab · workspace lab", layer: 3, kind: "group" },
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
  // ---- 0.3 Your Kubernetes cluster and LiteLLM: one layer per command
  // ---- 1.2 sign-in: Keycloak for people, a certificate for the lab's CLI
  "keycloak-flow": {
    title: "Who may call the gateway",
    w: 900, h: 320,
    layers: [{ n: 0, name: "all" }],
    nodes: [
      { id: "you", icon: "i-user", x: 0, y: 30, w: 170, h: 62, label: "You, in a browser", sub: "demo or learner", layer: 0 },
      { id: "con", icon: "i-portal", x: 240, y: 30, w: 200, h: 62, label: "OpenShell Console", sub: "oauth2-proxy + backend", layer: 0 },
      { id: "kc", icon: "i-people", x: 240, y: 200, w: 200, h: 80, label: "Keycloak", sub: "realm openshell\nusers, realm roles", layer: 0, kind: "ext" },
      { id: "gw", icon: "i-shield", x: 510, y: 100, w: 190, h: 80, label: "OpenShell gateway", sub: "checks every call:\nwho, which role", layer: 0, kind: "accent" },
      { id: "cli", icon: "i-term", x: 510, y: 240, w: 190, h: 62, label: "openshell CLI on the VM", sub: "client cert, OU=operator", layer: 0 },
      { id: "role", icon: "i-key", x: 740, y: 70, w: 160, h: 140, label: "What you may do", sub: "openshell-admin:\nevery workspace\nopenshell-user:\nyour workspaces", layer: 0 },
    ],
    edges: [
      { from: "you", to: "con", label: "open", layer: 0, kind: "ok" },
      { from: "con", to: "kc", label: "sign in (OIDC)", layer: 0, kind: "ok" },
      { from: "con", to: "gw", label: "your token", layer: 0, kind: "ok" },
      { from: "gw", to: "kc", label: "verify", layer: 0, kind: "dash" },
      { from: "cli", to: "gw", label: "mTLS", layer: 0, kind: "ok" },
      { from: "gw", to: "role", layer: 0, kind: "ok" },
    ],
  },
  // ---- 1.4 §1: what one `sandbox create` does
  "sandbox-create": {
    title: "What sandbox create does",
    w: 960, h: 300,
    layers: [{ n: 0, name: "all" }],
    nodes: [
      { id: "you", icon: "i-term", x: 0, y: 105, w: 190, h: 90, label: "sandbox create", sub: "openshell, the lab CLI\n--workspace dev", layer: 0 },
      { id: "gw", icon: "i-shield", x: 275, y: 95, w: 210, h: 110, label: "OpenShell gateway", sub: "stores the sandbox,\nits policy (revision 1)\nand its provider", layer: 0, kind: "accent" },
      { id: "ns", x: 540, y: 0, w: 420, h: 300, label: "namespace dev", layer: 0, kind: "group" },
      { id: "cr", icon: "i-doc", x: 556, y: 36, w: 158, h: 76, label: "Sandbox resource", sub: "pi-agent", layer: 0 },
      { id: "wl", icon: "i-bot", x: 775, y: 36, w: 180, h: 76, label: "workload pod", sub: "pi-agent\nthe agent runs here", layer: 0 },
      { id: "sup", icon: "i-shield", x: 775, y: 196, w: 180, h: 86, label: "supervisor pod", sub: "os-supervisor-<id>\nthe policy, the real key", layer: 0, kind: "accent" },
    ],
    edges: [
      { from: "you", to: "gw", label: "mTLS", layer: 0, kind: "ok" },
      { from: "gw", to: "cr", label: "writes", layer: 0, kind: "ok" },
      { from: "cr", to: "wl", label: "controller", layer: 0, kind: "ok" },
      { from: "gw", to: "sup", label: "starts", layer: 0, kind: "ok" },
      { from: "wl", to: "sup", label: "only way out", layer: 0, kind: "dash" },
    ],
  },
  // ---- 1.4 §2: the pod pair and the NetworkPolicy between them
  "sandbox-pair": {
    title: "One sandbox, two pods",
    w: 960, h: 300,
    layers: [{ n: 0, name: "all" }],
    nodes: [
      { id: "ns", x: 0, y: 0, w: 680, h: 300, label: "namespace dev", layer: 0, kind: "group" },
      { id: "wl", icon: "i-bot", x: 20, y: 40, w: 250, h: 96, label: "pi-agent", sub: "workload pod\nboundary-role=workload\nboundary-pair=<id>", layer: 0 },
      { id: "sup", icon: "i-shield", x: 410, y: 40, w: 250, h: 96, label: "os-supervisor-<id>", sub: "supervisor pod\nboundary-role=supervisor\nboundary-pair=<id>", layer: 0, kind: "accent" },
      { id: "np", icon: "i-route", x: 20, y: 180, w: 640, h: 96, label: "NetworkPolicies the gateway made", sub: "os-control-<id>: the workload may talk only to its own supervisor\nopenshell-sandbox-workloads, -supervisors: the defaults for each role\nopenshell-workspace-sandbox-ssh (from the chart): only the gateway reaches sandboxes", layer: 0 },
      { id: "out", icon: "i-globe", x: 740, y: 40, w: 220, h: 96, label: "Everything else", sub: "LiteLLM, registries, APIs:\nonly what the policy allows", layer: 0, kind: "ext" },
    ],
    edges: [
      { from: "wl", to: "sup", label: "same pair id", layer: 0, kind: "ok" },
      { from: "sup", to: "out", label: "policy", layer: 0, kind: "ok" },
    ],
  },
  // ---- 1.4 §4: pi sealed, the model works, curl doesn't, both logged
  "pi-sealed": {
    title: "pi, sealed",
    w: 960, h: 340,
    layers: [{ n: 0, name: "all" }],
    nodes: [
      { id: "sb", x: 0, y: 0, w: 300, h: 330, label: "sandbox pi-agent", layer: 0, kind: "group" },
      { id: "pi", icon: "i-bot", x: 18, y: 40, w: 264, h: 90, label: "pi asks the model", sub: "POST /v1/chat/completions\nLITELLM_API_KEY: a placeholder", layer: 0 },
      { id: "curl", icon: "i-term", x: 18, y: 200, w: 264, h: 90, label: "pi's bash tool runs curl", sub: "https://example.com", layer: 0, kind: "deny" },
      { id: "sup", icon: "i-shield", x: 390, y: 70, w: 230, h: 150, label: "Supervisor", sub: "model call: matches\n_provider_litellm\nexample.com: no rule", layer: 0, kind: "accent" },
      { id: "log", icon: "i-doc", x: 390, y: 260, w: 230, h: 70, label: "openshell logs pi-agent", sub: "ALLOWED and DENIED, as OCSF", layer: 0 },
      { id: "ll", icon: "i-route", x: 700, y: 40, w: 260, h: 90, label: "LiteLLM", sub: "gets the real key\nand answers pi", layer: 0 },
      { id: "no", icon: "i-ban", x: 700, y: 200, w: 260, h: 90, label: "Refused", sub: "curl gets no response: 000", layer: 0, kind: "deny" },
    ],
    edges: [
      { from: "pi", to: "sup", label: "allowed", layer: 0, kind: "ok" },
      { from: "curl", to: "sup", label: "no rule", layer: 0, kind: "deny" },
      { from: "sup", to: "ll", label: "real key", layer: 0, kind: "ok" },
      { from: "sup", to: "no", layer: 0, kind: "deny" },
      { from: "sup", to: "log", layer: 0, kind: "dash" },
    ],
  },
  // ---- 1.5 intro: how the supervisor decides
  "rule-check": {
    title: "How the supervisor decides",
    w: 960, h: 270,
    layers: [{ n: 0, name: "all" }],
    nodes: [
      { id: "wl", icon: "i-bot", x: 0, y: 30, w: 180, h: 96, label: "A program in the workload", sub: "curl, node, python3 …\nopens a connection", layer: 0 },
      { id: "c1", icon: "i-shield", x: 250, y: 30, w: 200, h: 96, label: "L4: which door?", sub: "an entry for this\nhost and port,\nfor this program?", layer: 0, kind: "accent" },
      { id: "c2", icon: "i-shield", x: 520, y: 30, w: 200, h: 96, label: "L7: which request?", sub: "protocol: rest only\nthe method and path", layer: 0, kind: "accent" },
      { id: "ok", icon: "i-globe", x: 790, y: 30, w: 170, h: 96, label: "Out to the host", sub: "a provider's key\nadded if one applies", layer: 0 },
      { id: "no", icon: "i-ban", x: 250, y: 190, w: 470, h: 70, label: "Refused, and logged", sub: "no entry: the connection fails (000, EACCES) · no matching rule: 403 policy_denied", layer: 0, kind: "deny" },
    ],
    edges: [
      { from: "wl", to: "c1", layer: 0, kind: "ok" },
      { from: "c1", to: "c2", label: "yes", layer: 0, kind: "ok" },
      { from: "c2", to: "ok", label: "yes", layer: 0, kind: "ok" },
      { from: "c1", to: "no", label: "no", layer: 0, kind: "deny" },
      { from: "c2", to: "no", label: "no", layer: 0, kind: "deny" },
    ],
  },
  // ---- 1.5 §2: the effective policy = your file + the provider's entry
  "effective-policy": {
    title: "The effective policy",
    w: 960, h: 290,
    layers: [{ n: 0, name: "all" }],
    nodes: [
      { id: "file", icon: "i-doc", x: 0, y: 10, w: 290, h: 120, label: "Your file: pi-agent.yaml", sub: "filesystem and process\nnpm_registry: registry.npmjs.org,\nread-only, /usr/bin/node only", layer: 0 },
      { id: "prov", icon: "i-key", x: 0, y: 170, w: 290, h: 110, label: "Provider litellm, attached", sub: "adds _provider_litellm:\nLiteLLM model calls,\nfrom any program", layer: 0 },
      { id: "eff", icon: "i-shield", x: 380, y: 60, w: 270, h: 170, label: "Effective policy, version 2", sub: "what policy get --full prints:\n_provider_litellm\nnpm_registry\neverything else: denied", layer: 0, kind: "accent" },
      { id: "sup", icon: "i-shield", x: 740, y: 100, w: 220, h: 90, label: "Supervisor", sub: "enforces it on\nevery connection", layer: 0 },
    ],
    edges: [
      { from: "file", to: "eff", label: "policy set", layer: 0, kind: "ok" },
      { from: "prov", to: "eff", label: "merged in", layer: 0, kind: "ok" },
      { from: "eff", to: "sup", label: "loaded", layer: 0, kind: "ok" },
    ],
  },
  // ---- 1.5 §3: one read-only L7 rule, GET allowed, POST refused
  "github-l7": {
    title: "A read-only rule for GitHub's API",
    w: 960, h: 300,
    layers: [{ n: 0, name: "all" }],
    nodes: [
      { id: "sb", x: 0, y: 0, w: 290, h: 300, label: "sandbox pi-agent", layer: 0, kind: "group" },
      { id: "get", icon: "i-term", x: 18, y: 44, w: 254, h: 90, label: "curl GET /zen", sub: "api.github.com:443", layer: 0 },
      { id: "post", icon: "i-term", x: 18, y: 180, w: 254, h: 90, label: "curl POST /markdown", sub: "same host, same program", layer: 0, kind: "deny" },
      { id: "rule", icon: "i-shield", x: 380, y: 60, w: 230, h: 180, label: "allow_api_github_com_443", sub: "read-only: GET, HEAD, OPTIONS\nrest: read each request (L7)\nenforce: block, not just log\nfor /usr/bin/curl only", layer: 0, kind: "accent" },
      { id: "gh", icon: "i-globe", x: 700, y: 44, w: 260, h: 90, label: "api.github.com", sub: "HTTP 200\nEncourage flow.", layer: 0 },
      { id: "no", icon: "i-ban", x: 700, y: 180, w: 260, h: 90, label: "403 policy_denied", sub: "layer l7, from the supervisor:\nGitHub never sees it", layer: 0, kind: "deny" },
    ],
    edges: [
      { from: "get", to: "rule", label: "GET", layer: 0, kind: "ok" },
      { from: "post", to: "rule", label: "POST", layer: 0, kind: "deny" },
      { from: "rule", to: "gh", layer: 0, kind: "ok" },
      { from: "rule", to: "no", layer: 0, kind: "deny" },
    ],
  },
  // ---- 1.5 §4: a plain TCP (L4) rule: one host, one port, one program
  "tcp-l4": {
    title: "A plain TCP rule",
    w: 960, h: 330,
    layers: [{ n: 0, name: "all" }],
    nodes: [
      { id: "sb", x: 0, y: 0, w: 290, h: 330, label: "sandbox pi-agent", layer: 0, kind: "group" },
      { id: "c1", icon: "i-term", x: 18, y: 36, w: 254, h: 76, label: "curl → example.com:443", sub: "the host and program in the rule", layer: 0 },
      { id: "c2", icon: "i-term", x: 18, y: 134, w: 254, h: 76, label: "curl → example.org:443", sub: "another host", layer: 0, kind: "deny" },
      { id: "c3", icon: "i-term", x: 18, y: 232, w: 254, h: 76, label: "python3 → example.com:443", sub: "another program", layer: 0, kind: "deny" },
      { id: "rule", icon: "i-shield", x: 380, y: 90, w: 230, h: 150, label: "allow_example_com_443", sub: "host and port only (L4)\nno protocol: the bytes\npass uninspected\nfor /usr/bin/curl only", layer: 0, kind: "accent" },
      { id: "ex", icon: "i-globe", x: 700, y: 36, w: 260, h: 90, label: "example.com", sub: "HTTP 200", layer: 0 },
      { id: "no", icon: "i-ban", x: 700, y: 180, w: 260, h: 110, label: "Refused, and logged", sub: "example.org: curl exit 7\npython3: Permission denied", layer: 0, kind: "deny" },
    ],
    edges: [
      { from: "c1", to: "rule", layer: 0, kind: "ok" },
      { from: "c2", to: "rule", layer: 0, kind: "deny" },
      { from: "c3", to: "rule", layer: 0, kind: "deny" },
      { from: "rule", to: "ex", label: "allowed", layer: 0, kind: "ok" },
      { from: "rule", to: "no", layer: 0, kind: "deny" },
    ],
  },
  // ---- 1.5 §5: four revisions of one policy
  "policy-revisions": {
    title: "Four revisions of one policy",
    w: 960, h: 140,
    layers: [{ n: 0, name: "all" }],
    nodes: [
      { id: "v1", icon: "i-doc", x: 0, y: 20, w: 215, h: 100, label: "Version 1", sub: "the baseline\nsandbox create --policy", layer: 0 },
      { id: "v2", icon: "i-doc", x: 248, y: 20, w: 215, h: 100, label: "Version 2", sub: "+ npm_registry\npolicy set, a whole file", layer: 0 },
      { id: "v3", icon: "i-doc", x: 496, y: 20, w: 215, h: 100, label: "Version 3", sub: "+ api.github.com, read-only\npolicy update", layer: 0 },
      { id: "v4", icon: "i-shield", x: 744, y: 20, w: 216, h: 100, label: "Version 4 · Loaded", sub: "+ example.com:443\npolicy update", layer: 0, kind: "accent" },
    ],
    edges: [
      { from: "v1", to: "v2", layer: 0, kind: "ok" },
      { from: "v2", to: "v3", layer: 0, kind: "ok" },
      { from: "v3", to: "v4", layer: 0, kind: "ok" },
    ],
  },
  // ---- 1.3.4 the provider's rules: a model call gets the key, anything else is refused
  "provider-l7": {
    title: "One placeholder, two requests",
    w: 960, h: 330,
    layers: [{ n: 0, name: "all" }],
    nodes: [
      { id: "sb", x: 0, y: 0, w: 290, h: 330, label: "sandbox agent-0", layer: 0, kind: "group" },
      { id: "ok", icon: "i-bot", x: 18, y: 48, w: 254, h: 92, label: "A model call", sub: "POST /v1/chat/completions\nAuthorization: Bearer <placeholder>", layer: 0 },
      { id: "bad", icon: "i-bot", x: 18, y: 200, w: 254, h: 92, label: "An admin call, same key", sub: "POST /key/generate\nAuthorization: Bearer <placeholder>", layer: 0, kind: "deny" },
      { id: "sup", icon: "i-shield", x: 390, y: 70, w: 236, h: 196, label: "Supervisor", sub: "checks each request against\n_provider_litellm:\nGET /v1/models\nPOST /v1/chat/completions\n… 6 model-call rules,\nnothing else", layer: 0, kind: "accent" },
      { id: "ll", icon: "i-route", x: 700, y: 40, w: 260, h: 92, label: "LiteLLM", sub: "receives the real key,\nswapped in on the way out,\nand answers", layer: 0 },
      { id: "no", icon: "i-key", x: 700, y: 200, w: 260, h: 92, label: "Refused at L7", sub: "403 policy_denied\nno key attached:\nLiteLLM never sees it", layer: 0, kind: "deny" },
    ],
    edges: [
      { from: "ok", to: "sup", label: "allowed", layer: 0, kind: "ok" },
      { from: "bad", to: "sup", label: "no rule", layer: 0, kind: "deny" },
      { from: "sup", to: "ll", label: "real key", layer: 0, kind: "ok" },
      { from: "sup", to: "no", layer: 0, kind: "deny" },
    ],
  },
  // ---- 1.2 what a workspace is: a record in the gateway + a namespace of the same name
  "workspace": {
    title: "A workspace",
    w: 900, h: 360,
    layers: [{ n: 0, name: "all" }],
    nodes: [
      { id: "g", x: 0, y: 0, w: 330, h: 350, label: "namespace openshell", layer: 0, kind: "group" },
      { id: "gw", icon: "i-shield", x: 20, y: 40, w: 290, h: 64, label: "OpenShell gateway", sub: "finds namespaces with the label", layer: 0, kind: "accent" },
      { id: "rec", icon: "i-db", x: 20, y: 130, w: 290, h: 100, label: "workspace \"lab\" (in the gateway)", sub: "providers: litellm (the real key)\nmembers: who may use it\nits sandboxes and their policies", layer: 0 },
      { id: "you", icon: "i-term", x: 20, y: 256, w: 290, h: 70, label: "You, the CLI or the Console", sub: "openshell --workspace lab …", layer: 0 },
      { id: "n", x: 390, y: 0, w: 510, h: 350, label: "namespace lab · label openshell.ai/workspace=true", layer: 0, kind: "group" },
      { id: "chart", icon: "i-bundle", x: 410, y: 40, w: 470, h: 74, label: "openshell-workspace chart", sub: "sandbox ServiceAccount · Role + RoleBinding for the gateway\nNetworkPolicy: only the gateway reaches sandboxes", layer: 0 },
      { id: "wl", icon: "i-bot", x: 410, y: 150, w: 210, h: 66, label: "agent-0", sub: "workload pod: the agent", layer: 0 },
      { id: "sup", icon: "i-shield", x: 670, y: 150, w: 210, h: 66, label: "supervisor pod", sub: "the policy, the real key", layer: 0, kind: "accent" },
      { id: "np", icon: "i-route", x: 410, y: 256, w: 470, h: 70, label: "per-sandbox NetworkPolicies", sub: "made by the gateway: the workload talks only to its supervisor", layer: 0 },
    ],
    edges: [
      { from: "you", to: "rec", layer: 0, kind: "ok" },
      { from: "rec", to: "gw", layer: 0, kind: "dash" },
      { from: "gw", to: "chart", label: "allowed by the Role", layer: 0, kind: "ok" },
      { from: "gw", to: "wl", label: "creates sandboxes", layer: 0, kind: "ok", dy: 14 },
      { from: "wl", to: "sup", layer: 0, kind: "dash" },
    ],
  },
  // ---- 1.2 how the lab was installed: one pipeline, left to right
  "install-flow": {
    title: "How the lab was installed",
    w: 900, h: 150,
    layers: [{ n: 0, name: "all" }],
    nodes: [
      { id: "l", icon: "i-cloud", x: 0, y: 40, w: 160, h: 70, label: "Brev Launchable", sub: "your model values", layer: 0, kind: "ext" },
      { id: "w", icon: "i-term", x: 185, y: 40, w: 160, h: 70, label: "setup script", sub: "writes .env", layer: 0 },
      { id: "s", icon: "i-term", x: 370, y: 40, w: 160, h: 70, label: "scripts/setup.sh", sub: "installs Ansible", layer: 0 },
      { id: "p", icon: "i-doc", x: 555, y: 40, w: 160, h: 70, label: "ansible/site.yml", sub: "one playbook", layer: 0 },
      { id: "r", icon: "i-gear", x: 740, y: 30, w: 160, h: 90, label: "roles, in order", sub: "03 to 19\none piece each", layer: 0, kind: "accent" },
    ],
    edges: [
      { from: "l", to: "w", layer: 0, kind: "ok" },
      { from: "w", to: "s", layer: 0, kind: "ok" },
      { from: "s", to: "p", layer: 0, kind: "ok" },
      { from: "p", to: "r", layer: 0, kind: "ok" },
    ],
  },
  // ---- 0.4 summary: what the agent reached, and what saw it
  "agent-unbounded": {
    title: "The agent as an ordinary Kubernetes workload",
    w: 860, h: 300,
    layers: [{ n: 0, name: "all" }],
    nodes: [
      { id: "k8s", icon: "i-wheel", x: 10, y: 10, w: 610, h: 280, label: "Kubernetes cluster", layer: 0, kind: "group" },
      { id: "ns", x: 26, y: 44, w: 278, h: 232, label: "namespace agents", layer: 0, kind: "group" },
      { id: "pod", icon: "i-bot", x: 42, y: 76, w: 246, h: 92, label: "pi-agent pod", sub: "pi · bash · curl · npm\nLITELLM_API_KEY: the real key\nServiceAccount token", layer: 0, kind: "deny" },
      { id: "logs", icon: "i-doc", x: 42, y: 206, w: 246, h: 56, label: "kubectl logs", sub: "the npm install, nothing else", layer: 0, dashed: true },
      { id: "ll", icon: "i-route", x: 360, y: 40, w: 240, h: 62, label: "LiteLLM", sub: "logs the model calls only", layer: 0, kind: "accent" },
      { id: "api", icon: "i-svc", x: 360, y: 178, w: 240, h: 62, label: "Kubernetes API", sub: "answers the pod's token", layer: 0 },
      { id: "model", icon: "i-cloud", x: 656, y: 40, w: 194, h: 62, label: "Your model", sub: "LiteLLM's upstream key", layer: 0, kind: "ext" },
      { id: "net", icon: "i-globe", x: 656, y: 112, w: 194, h: 70, label: "Any host", sub: "example.com or anywhere\nno rule, no log", layer: 0, kind: "deny" },
    ],
    edges: [
      { from: "pod", to: "ll", label: "model calls", layer: 0, kind: "ok", dy: -4 },
      { from: "ll", to: "model", layer: 0, kind: "ok" },
      { from: "pod", to: "net", label: "anything it runs", layer: 0, kind: "risk", dx: 40 },
      { from: "pod", to: "api", label: "token", layer: 0, kind: "risk", dy: 14 },
      { from: "pod", to: "logs", layer: 0, kind: "dash" },
    ],
  },
  // ---- 0.3.2 where a model gateway sits: drawn whole (<Diagram>), no layers
  "gateway-place": {
    title: "Where LiteLLM sits: between every agent and every model",
    w: 830, h: 300,
    layers: [{ n: 0, name: "all" }],
    nodes: [
      { id: "k8s", icon: "i-wheel", x: 10, y: 10, w: 568, h: 280, label: "Kubernetes cluster", layer: 0, kind: "group" },
      { id: "a1", icon: "i-bot", x: 30, y: 50, w: 220, h: 62, label: "pi-agent", sub: "the agent you deploy in 0.4", layer: 0 },
      { id: "a2", icon: "i-bot", x: 30, y: 127, w: 220, h: 62, label: "another agent", sub: "any harness, any team", layer: 0 },
      { id: "a3", icon: "i-cube", x: 30, y: 204, w: 220, h: 62, label: "an app", sub: "anything that calls a model", layer: 0 },
      { id: "ll", icon: "i-route", x: 334, y: 78, w: 226, h: 160, label: "LiteLLM", sub: "one OpenAI-compatible API\nmodel name → endpoint\nholds the real keys\nbudgets · rate limits · logs", layer: 0, kind: "accent" },
      { id: "ep", icon: "i-cloud", x: 608, y: 66, w: 216, h: 70, label: "Your inference endpoint", sub: "your model\nits real key", layer: 0, kind: "ext" },
      { id: "ot", icon: "i-globe", x: 608, y: 180, w: 216, h: 70, label: "Other providers", sub: "other APIs\nor local models", layer: 0, kind: "ext", dashed: true },
    ],
    edges: [
      { from: "a1", to: "ll", layer: 0, kind: "ok" },
      { from: "a2", to: "ll", label: "LiteLLM's key", layer: 0, kind: "ok", dy: -2 },
      { from: "a3", to: "ll", layer: 0, kind: "ok" },
      { from: "ll", to: "ep", label: "real key", layer: 0, kind: "ok" },
      { from: "ll", to: "ot", layer: 0, kind: "dash" },
    ],
  },
  "cluster-tour": {
    title: "Your cluster, as your commands find it",
    w: 960, h: 500,
    layers: [
      { n: 0, name: "You" },
      { n: 1, step: "1.1", name: "The node", note: "One k3s node, in two halves: the control plane (the API server and friends) decides, the worker side (kubelet, containerd) runs the pods, one namespace per component. kubectl talks to the API server." },
      { n: 2, step: "2.1", name: "LiteLLM", note: "One Deployment behind one Service, reachable only inside the cluster at litellm.litellm.svc.cluster.local:4000." },
      { n: 3, step: "2.2", name: "Its configuration", note: "LiteLLM's model list: your inference endpoint and model, under the alias default. The upstream key comes from a Secret." },
      { n: 4, step: "3.1", name: "A call", note: "From your shell on the VM, through a port-forward to the Service, with LiteLLM's master key; LiteLLM asks your model and the answer comes back to your shell." },
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
        ["os", "openshell + sandboxes", ["openshell", "lab", "dev", "agent-sandbox-system"], 470, 280, undefined, "i-shield"],
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
      { id: "ans", icon: "i-term", x: 15, y: 420, w: 170, h: 66, label: "the answer", sub: "\"Hello, I hope\nyou're well.\"", layer: 4, kind: "accent",
        dyn: (o) => {
          const m = /"content":"((?:[^"\\]|\\.)*)"/.exec(o(4) ?? ""); if (!m) return;
          const a = m[1].replace(/\\n/g, " ").replace(/\\"/g, '"').trim();
          return { sub: `"${short(a, 19)}\n${a.length > 18 ? short(a.slice(18), 19) : ""}` };
        } },
      { id: "up", icon: "i-globe", x: 15, y: 300, w: 170, h: 80, label: "model API", sub: "your inference\nendpoint", layer: 3, kind: "ext" },
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
  m2: {
    title: "Module 2: customize agents, then operate them",
    w: 600, h: 385,
    layers: [{ n: 0, name: "The sandbox" }, { n: 1, name: "Your own provider" }, { n: 2, name: "A persona" }, { n: 3, name: "Run a task" }, { n: 4, name: "The audit trail" }, { n: 5, name: "The Console" }],
    nodes: [
      { id: "soul", x: 10, y: 25, w: 170, h: 62, label: "AGENTS.md", sub: "persona", layer: 2 },
      { id: "wl", x: 210, y: 20, w: 180, h: 72, label: "agent-0", sub: "pi · placeholders", layer: 0 },
      { id: "ll", x: 420, y: 20, w: 170, h: 56, label: "LiteLLM → model", sub: "provider litellm", layer: 0, kind: "ext" },
      { id: "task", x: 10, y: 125, w: 170, h: 62, label: "a task", sub: "fleet task · all agents", layer: 3, kind: "accent" },
      { id: "sup", x: 210, y: 120, w: 180, h: 72, label: "supervisor pod", sub: "policy · real keys\nOCSF per decision", layer: 0, kind: "accent" },
      { id: "echo", x: 420, y: 110, w: 170, h: 56, label: "echo-api", sub: "your profile · rotate", layer: 1, kind: "ext" },
      { id: "loki", x: 10, y: 215, w: 170, h: 62, label: "Loki · Grafana", sub: "every allow and deny", layer: 4, kind: "ext" },
      { id: "con", x: 10, y: 310, w: 170, h: 62, label: "OpenShell Console", sub: "sandboxes · proposals", layer: 5, kind: "ext" },
      { id: "gw", x: 210, y: 310, w: 180, h: 62, label: "OpenShell gateway", sub: "one API, CLI and web", layer: 0, kind: "accent" },
    ],
    edges: [
      { from: "wl", to: "sup", layer: 0, kind: "dash" },
      { from: "gw", to: "sup", layer: 0, kind: "dash" },
      { from: "sup", to: "ll", layer: 0, kind: "ok" },
      { from: "sup", to: "echo", layer: 1, kind: "ok" },
      { from: "soul", to: "wl", layer: 2, kind: "dash" },
      { from: "task", to: "sup", layer: 3, kind: "ok" },
      { from: "sup", to: "loki", label: "OCSF", layer: 4, kind: "ok" },
      { from: "con", to: "gw", layer: 5, kind: "ok" },
    ],
  },

  m3: {
    title: "Module 3: tools and skills, the standard way",
    w: 600, h: 400,
    layers: [{ n: 0, name: "A sandbox" }, { n: 1, name: "An MCP server" }, { n: 2, name: "Rules per tool" }, { n: 3, name: "A skill repository" }],
    nodes: [
      { id: "sb", x: 10, y: 15, w: 280, h: 230, label: "sandbox tool-agent · workspace dev", layer: 0, kind: "group" },
      { id: "pi", icon: "i-bot", x: 25, y: 50, w: 250, h: 56, label: "pi", sub: "mcp.json · skills · the model via LiteLLM", layer: 0 },
      { id: "sk", icon: "i-doc", x: 25, y: 120, w: 250, h: 50, label: "~/.agents/skills", sub: "k8s-triage · incident-report · …", layer: 3 },
      { id: "sup", icon: "i-shield", x: 25, y: 182, w: 250, h: 52, label: "supervisor", sub: "protocol: mcp · tool rules", layer: 0, kind: "accent" },
      { id: "mcp", icon: "i-svc", x: 340, y: 30, w: 250, h: 74, label: "sre-tools MCP server", sub: "namespace tools · :8080/mcp\npod_status · prometheus · loki …", layer: 1, kind: "ext" },
      { id: "deny", icon: "i-ban", x: 340, y: 125, w: 250, h: 52, label: "scale_deployment", sub: "denied by the policy", layer: 2, kind: "deny" },
      { id: "git", icon: "i-git", x: 340, y: 200, w: 250, h: 62, label: "skill repository", sub: "Gitea · platform/skills\nclone only", layer: 3, kind: "ext" },
      { id: "you", icon: "i-term", x: 10, y: 290, w: 280, h: 56, label: "You, the platform team", sub: "write a skill · skill-lint · git push", layer: 3 },
    ],
    edges: [
      { from: "sup", to: "mcp", label: "4 tools", layer: 2, kind: "ok" },
      { from: "sup", to: "deny", layer: 2, kind: "deny" },
      { from: "sup", to: "git", label: "git clone", layer: 3, kind: "ok", dy: 10 },
      { from: "you", to: "git", label: "push", layer: 3, kind: "ok" },
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
      { id: "logs", x: 10, y: 130, w: 138, h: 56, label: "logs", sub: "loki_query", layer: 2 },
      { id: "met", x: 158, y: 130, w: 138, h: 56, label: "metrics", sub: "prometheus_query", layer: 2 },
      { id: "tr", x: 306, y: 130, w: 138, h: 56, label: "traces", sub: "tempo_search", layer: 2 },
      { id: "ev", x: 454, y: 130, w: 136, h: 56, label: "events", sub: "cluster_events", layer: 2 },
      { id: "st", x: 10, y: 230, w: 180, h: 56, label: "fleet status", sub: "Ready · tools · role", layer: 3 },
      { id: "rc", x: 210, y: 230, w: 180, h: 56, label: "root cause", sub: "scaled to 0 → you fix it", layer: 4, kind: "accent" },
      { id: "orch", x: 410, y: 230, w: 180, h: 56, label: "orchestrator", sub: "plan · tool calls · synthesise", layer: 5 },
      { id: "new", x: 210, y: 320, w: 180, h: 56, label: "your agent", sub: "+ role · tools · skills", layer: 6, dashed: true },
    ],
    edges: [
      { from: "you", to: "an", label: "fleet task", layer: 2, kind: "ok" },
      { from: "an", to: "logs", layer: 2, kind: "dash" }, { from: "an", to: "met", layer: 2, kind: "dash" },
      { from: "an", to: "tr", layer: 2, kind: "dash" }, { from: "an", to: "ev", layer: 2, kind: "dash" },
      { from: "met", to: "rc", label: "evidence", layer: 4, kind: "ok", dx: 26 },
    ],
  },
};
