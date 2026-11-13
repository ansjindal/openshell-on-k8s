// YAML files read part by part (<YamlRead id="…" />). `file` is a repo path
// copied in at build time (scripts/build-figures.mjs, YAML_FILES); `code` is
// inline text for excerpts. Each part lights the lines from the first line
// containing `from` to the first line at or after it containing `to`;
// "=text" instead matches a whole line.
export type YamlPart = { title: string; text: string; at: [string, string?][] };
export type YamlReadSpec = { title: string; intro: string; file?: string; code?: string; label?: string; parts: YamlPart[] };

export const YAML_READS: Record<string, YamlReadSpec> = {
  "pi-agent-deployment": {
    title: "The agent's Deployment, part by part",
    file: "manifests/agents/pi-agent.yaml",
    intro: "This is the whole file you apply below. Scroll down: each part lights up in the file as you read about it.",
    parts: [
      { title: "What it is, and where", at: [["apiVersion:", "namespace: agents"]],
        text: "A `Deployment` named `pi-agent` in the namespace `agents`: the most ordinary kind of Kubernetes workload, the way most apps run." },
      { title: "One copy, kept running", at: [["replicas: 1", "labels: { app: pi-agent }"]],
        text: "`replicas: 1` asks for one pod. The `selector` and the pod's `labels` tie the two together: Kubernetes keeps exactly one pod labelled `app: pi-agent` running, and starts a new one if it dies." },
      { title: "The container image", at: [["- name: agent", "image: node:22"]],
        text: "One container, from the stock `node:22` image: Node.js plus a full Debian userland with a shell, `curl` and `npm`. That's what a coding agent typically gets, and everything in it is available to the agent." },
      { title: "The key, as an environment variable", at: [["env:", "secretKeyRef"]],
        text: "`LITELLM_API_KEY` is filled from the Secret `litellm-key` you just made (`secretKeyRef`), so the **real key** sits in the container's environment, where any process in it can read it. `PI_OFFLINE=1` stops pi's own update check and telemetry." },
      { title: "Install pi when the pod starts", at: [["command:", "npm install"]],
        text: "The container runs `bash -c` with the script below. Its first line installs pi from npm, pinned to `@earendil-works/pi-coding-agent@1.5.2`. Every new pod installs it again; a production image would have it built in." },
      { title: "Point pi at LiteLLM", at: [["mkdir -p ~/.pi/agent", "=JSON"]],
        text: "The script writes pi's `models.json`: one provider, `lab`. `baseUrl` is LiteLLM's Service by its cluster DNS name; `api: openai-completions` because LiteLLM speaks the OpenAI API; `apiKey: \"$LITELLM_API_KEY\"` makes pi read the key from the environment when it runs; `compat` turns off two OpenAI-only features; and the one model is `default`, LiteLLM's alias for your model." },
      { title: "Then wait to be used", at: [["touch /tmp/ready", "sleep infinity"]],
        text: "`touch /tmp/ready` marks the install as done, and `sleep infinity` keeps the container running. The agent doesn't act on its own: you'll call it with `kubectl exec`." },
      { title: "Ready only when pi is", at: [["readinessProbe:", "periodSeconds"]],
        text: "Every 3 seconds the kubelet checks for `/tmp/ready`. Until it exists the pod is not Ready, so `kubectl rollout status` below waits for pi to be installed, not just for the container to start." },
      { title: "Memory", at: [["resources:", "limits:"]],
        text: "`requests` reserves 512 MiB on the node for the pod; `limits` stops it at 2 GiB (the container is killed if it goes over)." },
    ],
  },

  "pi-agent-policy": {
    title: "The sandbox policy, part by part",
    file: "manifests/policies/pi-agent.yaml",
    intro: "The lab's baseline policy plus one grant. Scroll down: each part lights up in the file as you read about it.",
    parts: [
      { title: "Files the agent may touch", at: [["filesystem_policy:", "read_write:"]],
        text: "`read_only` lists the system directories the agent may read; `read_write` the few it may write: `/sandbox` (its home), `/tmp` and `/dev/null`. `include_workdir` adds the working directory. Everything else on the filesystem is out of reach." },
      { title: "How the kernel enforces it", at: [["landlock:", "compatibility"]],
        text: "The file rules are applied with **Landlock**, a Linux kernel feature. `best_effort` uses whatever this kernel supports instead of refusing to start." },
      { title: "Who the agent runs as", at: [["process:", "run_as_group"]],
        text: "The agent runs as the unprivileged user and group `sandbox`, never root." },
      { title: "The network allow-list", at: [["network_policies:", "name: npm_registry"]],
        text: "Every connection the agent opens is checked against `network_policies`; anything not listed is **denied**. This file adds one entry, `npm_registry`. The name shows up in the audit log whenever the rule allows something." },
      { title: "Which host, and how it's checked", at: [["- host: registry.npmjs.org", "enforcement: enforce"]],
        text: "`registry.npmjs.org` on port 443. `protocol: rest` makes the supervisor look inside each HTTP request (layer 7), not just at the connection; `enforcement: enforce` refuses what doesn't match (`audit` would only log it)." },
      { title: "Read-only", at: [["access: read-only"]],
        text: "`access: read-only` allows only `GET`, `HEAD` and `OPTIONS`: the agent can download packages but can't publish or change anything." },
      { title: "Scoped package names", at: [["# scoped packages", "allow_encoded_slash"]],
        text: "Scoped packages such as `@earendil-works/…` are requested with an encoded `/` (`%2F`) in the path, which the L7 check refuses by default. `allow_encoded_slash: true` lets them through. It can only be set in a policy file like this one, not with `--add-endpoint`." },
      { title: "Which program may use it", at: [["binaries:", "path: /usr/bin/node"]],
        text: "Only `/usr/bin/node` (npm runs on it) may use this rule. `curl` in the same sandbox, asking for the same host, is still denied." },
    ],
  },

  "skills-locked-policy": {
    title: "The locked skills policy, part by part",
    file: "manifests/openclaw/policies/skills-locked.policy.yaml",
    intro: "The whole file you just applied. Scroll down: each part lights up in the file as you read about it.",
    parts: [
      { title: "Why it exists", at: [["# The \"locked\"", "Node 24"]],
        text: "The comments say it: the only place this sandbox may install from is the in-cluster registry. ClawHub and the public npm registry stay denied." },
      { title: "The same baseline", at: [["version: 1", "process:"]],
        text: "Files, Landlock and the `sandbox` user are the same as the lab's baseline policy: only the network part differs." },
      { title: "One network rule", at: [["network_policies:", "name: in-cluster-registry"]],
        text: "`network_policies` has a single entry, `in-cluster-registry`. Anything not listed is denied." },
      { title: "Why the encoded slash", at: [["# access: full", "never need the agent"]],
        text: "Scoped names such as `@workshop/x` are fetched as `/@workshop%2Fx`; `allow_encoded_slash` lets that `%2F` through, and it can only be set in a policy file. The registry (Verdaccio) fetches from public npm on the agent's behalf, so the agent itself never has to." },
      { title: "The registry endpoint", at: [["- { host: registry.openshell"]],
        text: "`registry.openshell.svc.cluster.local:4873`, inspected at L7 (`protocol: rest`) and enforced. `access: full` allows publishing as well as installing, because the skills lab publishes to it." },
      { title: "Which programs may use it", at: [["binaries: ["]],
        text: "`npm` and `node` in the places the image keeps them, plus OpenClaw's own Node 24. Any other program asking for the registry is denied." },
    ],
  },

  "metrics-agent-policy": {
    title: "The metrics agent's policy, part by part",
    label: "openshell policy get metrics --full (excerpt)",
    code: `network_policies:
  in-cluster-registry: { … }                 # every agent: install skills from your registry
  telemetry:
    name: telemetry
    endpoints:
      - { host: kps-kube-prometheus-stack-prometheus.monitoring.svc.cluster.local, port: 9090,
          protocol: rest, access: read-only, enforcement: enforce }   # GET/HEAD only, checked at L7
    binaries: [ { path: /usr/bin/node }, { path: /usr/local/lib/openclaw/node/bin/node }, { path: /usr/bin/curl } ]
# + _provider_litellm, merged in by the gateway from the attached \`litellm\` provider (model calls only)`,
    intro: "Beyond the registry, the `metrics` agent gets one rule, specific to its tool. Scroll down: each part lights up as you read about it.",
    parts: [
      { title: "What every agent shares", at: [["in-cluster-registry"]],
        text: "Every agent in the fleet may install skills from your in-cluster registry, and nothing else for installs." },
      { title: "Its one tool rule", at: [["telemetry:", "name: telemetry"]],
        text: "`telemetry` is the rule written for this agent's tool. `logs` and `events` get Loki instead, and `analyst` gets no `telemetry` rule at all." },
      { title: "Prometheus, read-only", at: [["- { host: kps", "enforcement: enforce }"]],
        text: "Prometheus inside the cluster on port 9090, inspected at L7 and **read-only**: `GET` queries work; a `POST`, or anything that would change data, is refused." },
      { title: "The programs allowed", at: [["binaries:"]],
        text: "Node (system and OpenClaw's own) and `curl`: the programs the agent's tool uses to query." },
      { title: "The model", at: [["# + _provider_litellm"]],
        text: "Model access isn't in the file: the gateway merges `_provider_litellm` in from the attached `litellm` provider, and it allows model calls only." },
    ],
  },
};
