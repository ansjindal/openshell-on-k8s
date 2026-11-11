// Specs for <Scene>: boxes on a board, routes between them, and steps that
// send requests along those routes (allowed, denied at a point, or a breach).
export type SceneNode = {
  id: string; x: number; y: number; w: number; h: number; label: string; sub?: string;
  kind?: "group" | "accent" | "ext" | "deny" | "warn";
  from?: number; until?: number; // the step it appears at / disappears at
  changes?: { at: number; label?: string; sub?: string; kind?: SceneNode["kind"] }[];
};
export type Packet = { route: string; result: "ok" | "deny" | "breach"; stopAt?: number; label?: string; log?: string; dur?: number };
export type Step = { title: string; text: string; yaml?: [number, number][]; packets: Packet[] };
export type SceneSpec = {
  title: string; w: number; h: number; breaches?: boolean; yaml?: string;
  nodes: SceneNode[]; routes: Record<string, [number, number][]>;
  wires?: Record<string, { pts: [number, number][]; from?: number; until?: number }>;
  steps: Step[];
};

const POLICY_YAML = `version: 1
filesystem_policy:
  read_only: [/usr, /lib, /etc, /proc]
  read_write: [/sandbox, /tmp]
landlock:
  compatibility: best_effort
process:
  run_as_user: sandbox
  run_as_group: sandbox
network_policies:
  github_readonly:
    endpoints:
      - host: api.github.com
        port: 443
        protocol: rest
        access: read-only
        enforcement: enforce
    binaries:
      - path: /usr/bin/curl`;

const toSup: [number, number][] = [[265, 74], [290, 74], [290, 196], [310, 196], [460, 196], [470, 196]];

export const SCENES: Record<string, SceneSpec> = {
  policy: {
    title: "One policy file, line by line",
    w: 640, h: 430, yaml: POLICY_YAML,
    nodes: [
      { id: "wp", x: 10, y: 10, w: 272, h: 410, label: "workload pod · the agent", kind: "group" },
      { id: "agent", x: 25, y: 45, w: 240, h: 58, label: "agent", sub: "OpenClaw or pi, with a shell" },
      { id: "files", x: 25, y: 140, w: 240, h: 58, label: "filesystem (Landlock)", sub: "/sandbox rw · /usr /etc ro" },
      { id: "proc", x: 25, y: 235, w: 240, h: 58, label: "process", sub: "user sandbox, uid 10001" },
      { id: "root", x: 25, y: 330, w: 240, h: 58, label: "root / setuid", sub: "not available", kind: "deny", from: 1 },
      { id: "sup", x: 310, y: 150, w: 150, h: 92, label: "supervisor", sub: "policy v1\nchecks each request", kind: "accent",
        changes: [{ at: 6, sub: "policy v2, loaded live\nno restart" }] },
      { id: "gh", x: 480, y: 20, w: 150, h: 58, label: "api.github.com", sub: "port 443", kind: "ext" },
      { id: "ex", x: 480, y: 110, w: 150, h: 58, label: "example.com", sub: "port 443" },
      { id: "ll", x: 480, y: 200, w: 150, h: 58, label: "LiteLLM", sub: "the model, :4000", kind: "ext", from: 5 },
    ],
    routes: {
      files: [[145, 103], [145, 140]],
      root: [[262, 90], [274, 90], [274, 359], [265, 359]],
      gh: [...toSup, [470, 49], [480, 49]],
      ex: [...toSup, [470, 139], [480, 139]],
      ll: [...toSup, [470, 229], [480, 229]],
    },
    steps: [
      { title: "Files: what the agent can touch", yaml: [[2, 4]],
        text: "filesystem_policy lists the paths the agent may read and the ones it may write. Landlock, in the kernel, enforces it: anything not listed is invisible. Fixed when the sandbox is created.",
        packets: [
          { route: "files", result: "ok", label: "write /sandbox/notes.md", log: "FS write /sandbox/notes.md    ✓ read_write" },
          { route: "files", result: "deny", stopAt: 0.95, label: "write /etc/hosts", log: "FS write /etc/hosts           ✕ read_only" },
          { route: "files", result: "deny", stopAt: 0.95, label: "read /root/.ssh", log: "FS read  /root/.ssh           ✕ not listed" },
        ] },
      { title: "Process: who the agent is", yaml: [[5, 9]],
        text: "The agent runs as the unprivileged user sandbox, and cannot become root: no sudo, no setuid. Like the filesystem, this is applied before the agent starts.",
        packets: [{ route: "root", result: "deny", stopAt: 0.92, label: "sudo -i", log: "PROC setuid root              ✕ runs as sandbox" }] },
      { title: "Network: deny by default", yaml: [[10, 10]],
        text: "Every connection goes through the supervisor, and network_policies is the whole list of what it may allow. Before any entry is added below this line, every connection is refused.",
        packets: [
          { route: "gh", result: "deny", label: "GET api.github.com", log: "NET:OPEN DENIED curl -> api.github.com:443 (no rule)" },
          { route: "ex", result: "deny", stopAt: 0.61, label: "GET example.com", log: "NET:OPEN DENIED curl -> example.com:443 (no rule)" },
        ] },
      { title: "One endpoint, down to the method", yaml: [[11, 17]],
        text: "An entry names a host and port. protocol: rest makes the supervisor read each HTTP request (L7); access: read-only allows GET, HEAD and OPTIONS. enforcement: enforce blocks; audit would only log.",
        packets: [
          { route: "gh", result: "ok", label: "GET /zen", log: "HTTP:GET  ALLOWED api.github.com/zen [github_readonly]" },
          { route: "gh", result: "deny", label: "POST /markdown", log: "HTTP:POST DENIED api.github.com/markdown [l7] 403" },
          { route: "ex", result: "deny", stopAt: 0.61, label: "GET example.com", log: "NET:OPEN DENIED curl -> example.com:443 (no rule)" },
        ] },
      { title: "Which programs may use it", yaml: [[18, 19]],
        text: "binaries scopes the entry to the programs named: curl may reach GitHub. Python, going to the same host, is refused: a prompt-injected script can't borrow curl's permission.",
        packets: [
          { route: "gh", result: "ok", label: "curl GET", log: "HTTP:GET  ALLOWED /usr/bin/curl -> api.github.com" },
          { route: "gh", result: "deny", label: "python3 GET", log: "NET:OPEN DENIED /usr/bin/python3 -> api.github.com:443" },
        ] },
      { title: "Providers add their own entry",
        text: "Attaching a provider (here litellm) merges its own entry into the policy, _provider_litellm, with its L7 rules. Allowed calls get the real key added by the supervisor; the admin API has no rule.",
        packets: [
          { route: "ll", result: "ok", label: "POST /v1/chat/completions", log: "HTTP:POST ALLOWED litellm …/v1/chat/completions (key added)" },
          { route: "ll", result: "deny", stopAt: 0.65, label: "POST /key/generate", log: "HTTP:POST DENIED litellm …/key/generate [l7] 403" },
        ] },
      { title: "Change it while it runs", yaml: [[10, 19]],
        text: "network_policies is dynamic: openshell policy update (or policy set with a file) loads a new revision into the running sandbox in seconds. Files and process (lines 2 to 9) stay as they were at creation.",
        packets: [
          { route: "gh", result: "ok", label: "GET (policy v2)", log: "CONFIG:LOADED policy v2   ·   HTTP:GET ALLOWED api.github.com" },
          { route: "ex", result: "deny", stopAt: 0.61, label: "GET example.com", log: "NET:OPEN DENIED curl -> example.com:443 (no rule)" },
        ] },
    ],
  },

  sentry: {
    title: "When the host itself is in scope",
    w: 640, h: 450, breaches: true,
    nodes: [
      { id: "host", x: 10, y: 10, w: 400, h: 300, label: "host · the agent's Linux server", kind: "group" },
      { id: "agent", x: 30, y: 50, w: 160, h: 58, label: "agent", sub: "in its sandbox" },
      { id: "sup", x: 220, y: 50, w: 170, h: 58, label: "OpenShell supervisor", sub: "policy · audit log", kind: "accent",
        changes: [{ at: 1, label: "supervisor: stopped", sub: "policy rewritten, logs wiped", kind: "deny" }] },
      { id: "atk", x: 30, y: 220, w: 160, h: 58, label: "attacker", sub: "root on the host", kind: "warn", from: 1 },
      { id: "dpu", x: 10, y: 330, w: 400, h: 110, label: "BlueField-4 DPU · its own CPU and OS", kind: "group", from: 2 },
      { id: "argus", x: 30, y: 362, w: 170, h: 58, label: "DOCA Argus", sub: "which program sent it", kind: "accent", from: 2 },
      { id: "tower", x: 220, y: 362, w: 170, h: 58, label: "DOCA Tower", sub: "the same OpenShell policy", kind: "accent", from: 2 },
      { id: "api", x: 460, y: 50, w: 170, h: 58, label: "approved API", sub: "in the policy", kind: "ext" },
      { id: "evil", x: 460, y: 200, w: 170, h: 58, label: "attacker's server", sub: "not in the policy", kind: "deny" },
    ],
    routes: {
      okHost: [[190, 79], [220, 79], [390, 79], [460, 79]],
      evilHost: [[190, 79], [220, 79], [305, 79], [305, 140], [440, 140], [440, 229], [460, 229]],
      breach: [[190, 95], [425, 95], [425, 229], [460, 229]],
      okDpu: [[190, 100], [205, 100], [205, 391], [220, 391], [390, 391], [440, 391], [440, 79], [460, 79]],
      evilDpu: [[190, 100], [205, 100], [205, 391], [220, 391], [305, 391]],
      tamper: [[110, 278], [110, 362]],
    },
    steps: [
      { title: "OpenShell on the host",
        text: "The agent sits in its sandbox; the supervisor beside it checks every connection against the policy. The approved API is reached; the attacker's server is refused and logged.",
        packets: [
          { route: "okHost", result: "ok", label: "GET approved API", log: "ALLOWED agent -> approved API (policy)" },
          { route: "evilHost", result: "deny", stopAt: 0.27, label: "POST attacker", log: "DENIED  agent -> attacker's server (no rule)" },
        ] },
      { title: "When the host is compromised",
        text: "The supervisor runs on the same host as the agent. With root on that host, an attacker can stop it, rewrite the policy and wipe the logs. Requests then leave unchecked, and nothing records them.",
        packets: [
          { route: "breach", result: "breach", label: "POST secrets", log: "(no supervisor) request left the host unchecked" },
          { route: "breach", result: "breach", label: "POST more", log: "(no log) nothing records it" },
        ] },
      { title: "Raise the Sentry tower",
        text: "NVIDIA Sentry moves the network decision onto BlueField-4, with its own CPU and operating system. DOCA Tower enforces the same OpenShell policy; DOCA Argus tells it which program sent each request. Root on the host can't reach either.",
        packets: [
          { route: "okDpu", result: "ok", label: "GET approved API", log: "Tower ALLOWED agent -> approved API (Argus: the agent's program)" },
          { route: "evilDpu", result: "deny", stopAt: 0.98, label: "POST attacker", log: "Tower DENIED agent -> attacker's server (not in the policy)" },
          { route: "tamper", result: "deny", stopAt: 0.9, label: "rewrite policy", log: "host root has no access to the DPU: policy unchanged" },
        ] },
      { title: "One policy, the layers you need",
        text: "The same policy file works in both places. Start with OpenShell on any Linux host, on bare metal, Docker or Kubernetes; add Sentry on BlueField-4 when the host itself is in scope.",
        packets: [
          { route: "okDpu", result: "ok", label: "GET approved API", log: "Tower ALLOWED agent -> approved API" },
          { route: "evilDpu", result: "deny", stopAt: 0.98, label: "POST attacker", log: "Tower DENIED agent -> attacker's server" },
        ] },
    ],
  },
};
