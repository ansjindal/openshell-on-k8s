// Step texts for <ReadScene>: one entry per scene of the OpenShell talks
// (public/scenes/*.html), one text per step, in order. Step n of the picture
// is shown while you read step n.
export type SceneStep = { label: string; text: string };
export const SCENE_STEPS: Record<string, { src: string; title: string; intro: string; steps: SceneStep[] }> = {
 "agent": {
  "src": "openshell",
  "title": "What is an agent?",
  "intro": "A model in a ReAct loop (reason, act, observe), plus the knowledge it reads, the tools it calls, the skills it loads and the harness that runs it all. The model only suggests. The harness acts, as a process, with your access.",
  "steps": [
   {
    "label": "The ReAct loop",
    "text": "ReAct (Reason + Act, Yao et al., 2022): the model reasons about the next step, acts with a tool, observes the result, and goes round again."
   },
   {
    "label": "Repeat until done",
    "text": "It repeats until the model decides it is done. No human approves each step; for a coding agent that can mean hours of turns."
   },
   {
    "label": "Knowledge",
    "text": "Knowledge: everything the agent reads into its context window: the system prompt, project rules such as AGENTS.md, retrieved docs, memory of earlier steps, and the task itself."
   },
   {
    "label": "Model",
    "text": "Model: the LLM behind an inference API. Each turn it reads the context and returns the next step: a thought, a tool call or a final answer."
   },
   {
    "label": "Tools",
    "text": "Tools: how a thought becomes an action. A shell, file edits, web fetch, the GitHub API, MCP servers. Their results come back as observations."
   },
   {
    "label": "Skills",
    "text": "Skills: packaged know-how loaded only when a task needs it, a folder with a SKILL.md. OpenShell adds one itself: policy-advisor, which teaches the agent how to ask for access."
   },
   {
    "label": "Harness",
    "text": "Harness: the program that runs the loop. It builds the context, calls the model, runs the tools and asks for permission. Claude Code, Codex, OpenCode and OpenClaw are harnesses."
   },
   {
    "label": "With your access",
    "text": "The model only suggests. The harness acts, as an ordinary process with your keys, tokens, cloud credentials, files and network. And everything it reads becomes knowledge, including an issue a stranger wrote."
   }
  ]
 },
 "poisoned": {
  "src": "openshell",
  "title": "One poisoned issue",
  "intro": "Same agent, same picture. Watch which parts one hidden comment in issue #142 touches. Nothing was hacked. Every part did its job.",
  "steps": [
   {
    "label": "Knowledge: the entry point",
    "text": "1 Knowledge is the entry point. A hidden HTML comment in issue #142: GitHub does not render it, but the agent reads the raw text into its context."
   },
   {
    "label": "Model: misled",
    "text": "2 The model is misled. It cannot tell the task from the attacker’s text, so its next thought is to upload your SSH keys. Nothing in it was hacked."
   },
   {
    "label": "Harness and tools: carry it out",
    "text": "3 The harness and its tools carry it out. The shell runs tar and curl; the GitHub API tool uses your token to delete the repository."
   },
   {
    "label": "Your access: the blast radius",
    "text": "4 Your access is the blast radius. Keys and tokens leave, cloud credentials come from the metadata endpoint, the repo is deleted, and pip pulls from an attacker’s index."
   },
   {
    "label": "What was affected",
    "text": "Knowledge let it in, the model decided, the harness and tools acted, your access set the damage. Every part did its job. Skills, MCP servers and web pages are knowledge too, so the same path opens from any of them."
   }
  ]
 },
 "guardrail": {
  "src": "openshell",
  "title": "Where should the guardrail live?",
  "intro": "Same picture, three places: in the prompt, inside the harness, or outside the whole process. Only the outside can't be argued with or bypassed from within.",
  "steps": [
   {
    "label": "In the prompt",
    "text": "In the prompt: \"never upload secrets\" is text in the same context as the attacker’s text. The model weighs both, and sometimes the attacker wins."
   },
   {
    "label": "Inside the harness",
    "text": "Inside the harness: allowlists and permission prompts run in the same process. An allowed tool like pytest runs the repo’s conftest.py, which can do anything the process can."
   },
   {
    "label": "Outside the process",
    "text": "Outside the process: the kernel and a proxy the agent cannot reach stand between the harness and everything it could touch. The agent can only ask. This is where OpenShell sits."
   },
   {
    "label": "What it must do",
    "text": "That boundary must:\n1 deny by default\n2 grant least privilege per program\n3 keep secrets out of the agent\n4 change without a restart\n5 record every decision"
   }
  ]
 },
 "intro": {
  "src": "openshell",
  "title": "Enter NVIDIA OpenShell",
  "intro": "One tool for building that boundary: an open-source runtime that puts the whole agent process in a sandbox governed by a YAML policy. You declare what the agent can touch. OpenShell enforces it from outside.",
  "steps": [
   {
    "label": "One sandbox around the agent",
    "text": "NVIDIA OpenShell is an open-source runtime (Apache 2.0, version 0.1.7). It runs the agent’s whole process inside a sandbox, and a supervisor on its edge decides what crosses it."
   },
   {
    "label": "Four controls",
    "text": "Four controls, at the points where harm happened: files and process rules lock when the sandbox starts; network and credential rules can change while it runs."
   },
   {
    "label": "Verified and audited",
    "text": "You declare all of it in one YAML policy. A prover checks proposed changes with formal verification before anyone approves them, and every allow and deny becomes an OCSF event."
   },
   {
    "label": "Any agent, anywhere",
    "text": "It wraps the harness you already use, such as Claude Code, Codex, OpenCode, OpenClaw or your own, on a laptop with Docker or Podman, in a MicroVM, or in a Kubernetes Pod."
   }
  ]
 },
 "contained": {
  "src": "openshell",
  "title": "Same agent, inside OpenShell",
  "intro": "Same picture, same poisoned issue. The model is still misled, but every harmful step now stops at the boundary. OpenShell doesn't make the agent smarter. It makes its mistakes harmless.",
  "steps": [
   {
    "label": "Same poison, same plan",
    "text": "OpenShell does not change the model. The poisoned issue still misleads it, and the harness still tries to carry out the plan."
   },
   {
    "label": "Every harmful step stops",
    "text": "Every harmful step now stops at the boundary: the key read in the kernel, the upload, the repo deletion, the metadata call and the bad index at the supervisor, sudo at seccomp."
   },
   {
    "label": "The real work still flows",
    "text": "Reading the issue and installing from PyPI still work: allowed requests pass through the supervisor. The agent keeps doing its job."
   },
   {
    "label": "What stopped it",
    "text": "OpenShell does not make the agent smarter. It makes its mistakes harmless, and every decision is an OCSF event you can audit."
   }
  ]
 },
 "arch": {
  "src": "openshell",
  "title": "The big picture",
  "intro": "A gateway (control plane) and, per sandbox, a trusted supervisor beside an untrusted workload (data plane), built around an agent as it runs on Kubernetes. The gateway never decides a packet. The supervisor decides every one.",
  "steps": [
   {
    "label": "Interfaces",
    "text": "Interfaces: the CLI, SDKs and TUI. Everything you do goes through the gateway API."
   },
   {
    "label": "Gateway: API server",
    "text": "The gateway runs as one Pod per replica, with a single container, openshell-gateway. Its API server authenticates you (mTLS, OIDC or an edge proxy), authorizes by role and workspace, and runs each sandbox’s lifecycle."
   },
   {
    "label": "Gateway: durable state",
    "text": "Durable state sits outside the process. By default the chart runs a StatefulSet with SQLite on the Pod’s own volume, openshell-data, so one replica. For two or more, a Deployment points at PostgreSQL in its own Pods."
   },
   {
    "label": "Gateway: drivers",
    "text": "The drivers are built into the same container. The Kubernetes compute driver places and fences each sandbox through the Kubernetes API; the credential driver keeps provider secrets in the database, Kubernetes Secrets or Vault."
   },
   {
    "label": "Gateway: prover, interceptors",
    "text": "The policy prover is built in too. Interceptors are different: your own gRPC service in its own Pods, which the gateway calls on selected API writes."
   },
   {
    "label": "Supervisor Pod",
    "text": "Supervisor Pod (trusted): evaluates policy, resolves credentials, answers DNS, proxies every connection and keeps the session to the gateway. It dials out; the gateway never dials in."
   },
   {
    "label": "Workload Pod",
    "text": "Workload Pod (untrusted): an init container copies in openshell-sandbox, which runs as PID 1 in the \"agent\" container and starts the agent as its child. A NetworkPolicy lets the Pod reach only the supervisor."
   },
   {
    "label": "Traffic and telemetry",
    "text": "Every connection goes agent → openshell-sandbox → supervisor → out, or nowhere. The gateway’s exporter and each supervisor send traces and OCSF events to your collector."
   }
  ]
 },
 "halves": {
  "src": "openshell",
  "title": "The boundary up close",
  "intro": "openshell-sandbox lives inside with the agent. It owns the process tree, names the calling binary and holds nothing worth stealing. openshell-supervisor lives outside. It holds policy, credentials and DNS, and opens every real connection. One mTLS HTTP/2 connection between them, one stream per TCP connection.",
  "steps": [
   {
    "label": "Two halves",
    "text": "Two halves. The supervisor, outside, holds the decisions, the secrets and the real upstream sockets. The sandbox runtime, inside with the agent, owns the process tree, knows which binary made each connection, and mediates it."
   },
   {
    "label": "One channel, many streams",
    "text": "One channel, many streams. The two halves talk over a single connection; every TCP connection the agent opens becomes its own stream with its own backpressure. The transport depends on the platform: a Unix socket for Docker or Podman, TCP with mTLS on Kubernetes, vsock for a microVM."
   },
   {
    "label": "Outer fence",
    "text": "Outer fence. Around the workload, the platform drops any direct egress: the only route out is the channel to the supervisor. On Kubernetes that fence is a NetworkPolicy."
   },
   {
    "label": "Fail closed",
    "text": "Fail closed. If the channel to the supervisor is lost, the agent is frozen rather than set free, and only the same supervisor process may reconnect."
   }
  ]
 },
 "versions": {
  "src": "openshell",
  "title": "The supervisor moved out",
  "intro": "In 0.0.x the supervisor ran inside the agent's container as its parent, with the privilege to build the boundary right next to the agent. 0.1.0 (RFC 0012) split it: a capability-free runtime inside, the supervisor outside, an isolation-backend contract between. 0.0.x sandboxes can't be upgraded in place. Recreate them.",
  "steps": [
   {
    "label": "v0.0.x",
    "text": "In 0.0.x the supervisor ran inside the agent's container, as its parent process, with the privilege needed to build the boundary right next to the agent."
   },
   {
    "label": "v0.1.x, dedicated",
    "text": "From 0.1.0 (RFC 0012) the supervisor lives outside, by default in a dedicated pod per sandbox. Inside is a capability-free runtime, and an isolation-backend contract sits between them."
   },
   {
    "label": "Shared (experimental)",
    "text": "An experimental shared topology lets one supervisor deployment serve many sandboxes, each still with its own policy, credentials and gateway session."
   },
   {
    "label": "RFC 0018 (draft)",
    "text": "Further work (RFC 0018, a draft) continues to separate the pieces. Sandboxes from 0.0.x can't be upgraded in place: recreate them."
   }
  ]
 },
 "policy": {
  "src": "openshell",
  "title": "One YAML file, two lifetimes",
  "intro": "This is the policy for a coding agent. Each step highlights one section and explains it. Startup sections lock when the sandbox starts. Live sections change while it runs.",
  "steps": [
   {
    "label": "filesystem_policy",
    "text": "filesystem_policy lists the paths the agent can read, or read and write; everything else is inaccessible. include_workdir adds the working directory, the cloned repo. Here the agent can edit the repo and /tmp, and ~/.ssh simply doesn't exist for it."
   },
   {
    "label": "landlock",
    "text": "landlock.compatibility decides what happens if the kernel can't apply the filesystem rules. hard_requirement refuses to start the agent unconfined; best_effort runs and logs a high-severity finding. An agent with your repo and tokens should never run unconfined."
   },
   {
    "label": "process",
    "text": "process sets the user and group the agent runs as, never root. Always on, even though not in the file: no Linux capabilities, no_new_privs, and seccomp filters that block escalation. A sudo or a mount gets EPERM."
   },
   {
    "label": "network_policies",
    "text": "network_policies is a map of named rules. Each rule pairs endpoints with binaries, and a connection is allowed only when both match. protocol: rest turns on request inspection, enforcement: enforce makes it block (audit only logs), access: read-only allows GET, HEAD and OPTIONS."
   },
   {
    "label": "network_middlewares",
    "text": "network_middlewares run, in order, on traffic the rules allow, before credentials are added: for example redacting secrets from requests to api.github.com."
   },
   {
    "label": "Two lifetimes",
    "text": "Two lifetimes. The first three sections are startup sections: they lock when the sandbox starts. Network rules and middlewares are live: a change goes to the gateway, which validates it and saves a new revision, and the supervisor validates and loads it into the running sandbox."
   },
   {
    "label": "Which policy runs",
    "text": "Which policy runs. Every change is a numbered revision; the sandbox runs the latest one its supervisor has loaded, and you can see which in openshell policy list."
   }
  ]
 },
 "kernel": {
  "src": "openshell",
  "title": "Two kernel filters",
  "intro": "seccomp decides which system calls a process may make. Landlock decides which files and folders it may touch. openshell-sandbox switches both on before the agent starts; every process the agent starts inherits them. They run in whichever kernel runs the agent.",
  "steps": [
   {
    "label": "seccomp: system calls",
    "text": "seccomp decides which system calls a process may make. Escalation and escape calls get EPERM; network calls are paused so the supervisor can decide them."
   },
   {
    "label": "Landlock: files",
    "text": "Landlock decides which files and folders the process may touch. A path that isn't in the policy gets EACCES; a path listed as read-write is allowed."
   },
   {
    "label": "Set once, for every process",
    "text": "Both are set once, by openshell-sandbox, before the agent starts, and every process the agent starts inherits them. Nothing inside can switch them off."
   },
   {
    "label": "Where they run",
    "text": "They run in whichever kernel runs the agent: the node's kernel for a container, the guest kernel for a microVM. OpenShell 0.1 needs Landlock ABI v3, so Linux 6.2 or newer."
   }
  ]
 },
 "request": {
  "src": "openshell",
  "title": "One request, end to end",
  "intro": "Follow the agent's gh call to read issue #142 through five checkpoints. The secret is added last, outside the agent, and only for the right host.",
  "steps": [
   {
    "label": "Pause the connect()",
    "text": "To read issue #142 the agent runs gh. When gh calls connect(), seccomp, the kernel’s system-call filter, pauses it. Nothing has left the sandbox yet."
   },
   {
    "label": "Check the connection",
    "text": "openshell-sandbox reads the real program and the destination and asks the supervisor. The policy allows /usr/bin/gh to reach api.github.com on 443, so gh gets a socket that leads to the supervisor."
   },
   {
    "label": "Check the request, add the secret",
    "text": "For HTTPS endpoints with rules, the supervisor opens the request: GET is allowed by the read-only rule. Last, it swaps the placeholder for the real token, then sends the request on."
   },
   {
    "label": "What gets blocked",
    "text": "Each request stops at the first check it fails, and every decision is an OCSF event. The upload and the metadata call never get past the connection check."
   }
  ]
 },
 "creds": {
  "src": "openshell",
  "title": "The agent never holds the key",
  "intro": "Providers keep credentials in the gateway. Inside the sandbox the agent sees only placeholders such as openshell:resolve:env:GITHUB_TOKEN. The supervisor swaps in the real value only for endpoints the provider allows. Steal the environment and you get placeholders.",
  "steps": [
   {
    "label": "Store it once",
    "text": "Store it once. A provider (github, holding GITHUB_TOKEN) keeps the credential in the gateway's credential driver. The supervisor receives the value; the sandbox never does."
   },
   {
    "label": "Placeholders inside",
    "text": "Placeholders inside. The agent's environment holds only openshell:resolve:env:GITHUB_TOKEN. A poisoned agent that pipes its environment to a paste site is denied anyway, and even if it weren't, there's nothing usable to steal."
   },
   {
    "label": "Swapped on the way out",
    "text": "Swapped on the way out. On a request to an endpoint the provider allows, the supervisor replaces the placeholder with the real token as the request leaves. The agent never sees it."
   },
   {
    "label": "Wrong host, no secret",
    "text": "Wrong host, no secret. Two checks must both pass: the network policy allows the binary and host, and the credential is bound to that host, port and path. A placeholder sent to any other host is refused (credential_endpoint_mismatch) and raises a high-severity finding."
   },
   {
    "label": "Rotate without a restart",
    "text": "Rotate without a restart. Rotating or revoking a credential applies to running sandboxes at once: same placeholder, new value. Only a brand-new environment variable needs a new process."
   }
  ]
 },
 "obs": {
  "src": "openshell",
  "title": "Three signals, one sandbox ID",
  "intro": "Traces show where time goes, gateway metrics show saturation, and OCSF events record every security decision. Supervisors export directly. Agent spans go to a relay at 192.0.0.8:4318, with no egress rule needed. Join everything on openshell.sandbox.id.",
  "steps": [
   {
    "label": "Traces",
    "text": "Traces show where time goes: a CreateSandbox call, the compute driver provisioning it, the supervisor starting and loading its policy, all one trace."
   },
   {
    "label": "Metrics",
    "text": "Gateway metrics show saturation: gRPC request rates, pending relays, supervisor sessions. Graph sessions; scale on CPU."
   },
   {
    "label": "OCSF events",
    "text": "OCSF events record every security decision: a network connection allowed, an HTTP request denied, a user's sign-in. Each carries the sandbox ID."
   },
   {
    "label": "Agent spans",
    "text": "Agent spans: the agent's own OpenTelemetry spans go to a relay the supervisor provides, with no egress rule needed, tagged with the sandbox ID. Best effort, with a size limit."
   }
  ]
 },
 "ocsf": {
  "src": "openshell",
  "title": "Reading an OCSF event",
  "intro": "OpenShell maps security events to OCSF v1.8.0: network and HTTP decisions, processes, SSH, authentication, config changes and findings. The same event appears as a shorthand line, a JSONL record or an OTLP log record. OTLP delivery is at least once. Deduplicate on ocsf.metadata.uid and alert on gaps.",
  "steps": [
   {
    "label": "Anatomy",
    "text": "Anatomy of a shorthand line: the event class (NET:OPEN), the severity ([MED]), the action (DENIED), the process and destination (/usr/bin/curl -> httpbin.org:443), which engine and rule decided, and the reason."
   },
   {
    "label": "Event classes",
    "text": "Event classes cover network and HTTP decisions, processes, SSH, authentication, configuration changes and findings, mapped to OCSF v1.8.0."
   },
   {
    "label": "Three forms",
    "text": "Three forms of the same event: a shorthand line in the logs, a JSONL record, and an OTLP log record for your collector."
   },
   {
    "label": "Delivery guarantees",
    "text": "Delivery over OTLP is at least once: deduplicate on ocsf.metadata.uid, and alert on gaps."
   }
  ]
 },
 "k8s": {
  "src": "openshell",
  "title": "One sandbox on Kubernetes",
  "intro": "Built up in deployment order: LiteLLM, observability, OpenShell, a workspace, then a sandbox. The agent reaches its model only through the supervisor and LiteLLM.",
  "steps": [
   {
    "label": "The cluster",
    "text": "An empty Kubernetes cluster: a control plane (k3s in the lab) and three CPU worker nodes. No GPU nodes are needed, because the models run on the NVIDIA API."
   },
   {
    "label": "Deploy LiteLLM",
    "text": "First the model gateway: LiteLLM, two replicas and their Postgres behind svc/litellm on port 4000. It holds the NVIDIA key and each team’s budget."
   },
   {
    "label": "Deploy observability",
    "text": "Then the observability stack: Prometheus and Grafana, Tempo for traces, Loki and Alloy for logs. OpenShell will send traces and OCSF events here."
   },
   {
    "label": "Deploy Keycloak",
    "text": "Then the identity provider: Keycloak with its own Postgres and the realm openshell, whose groups grant openshell-admin or openshell-user and whose openshell-cli client the CLI signs in with."
   },
   {
    "label": "Install the OpenShell chart",
    "text": "Agent Sandbox (controller and CRDs) goes first, as a prerequisite. Then the OpenShell chart: two gateway replicas on CloudNativePG PostgreSQL behind svc/openshell, trusting Keycloak for login and Vault for credentials."
   },
   {
    "label": "Install a workspace",
    "text": "A workspace is a namespace. The openshell-workspace chart goes into team-ml and adds the sandbox ServiceAccount, a Role and RoleBinding so the gateway can act there, and a NetworkPolicy. The quota comes from git. It spans whichever nodes its Pods land on."
   },
   {
    "label": "Create a sandbox",
    "text": "You sign in with Keycloak and call CreateSandbox; the gateway checks the token. The Agent Sandbox controller creates the workload Pod and the gateway the supervisor Pod, both in team-ml. The supervisor dials out to a gateway replica and reaches its workload through svc/os-boundary on 5500, over mTLS."
   },
   {
    "label": "The agent calls a model",
    "text": "The agent’s request goes through the supervisor, which adds the workspace’s LiteLLM key, to svc/litellm on port 4000. LiteLLM holds the model key and calls the model API."
   },
   {
    "label": "Fence and telemetry",
    "text": "Direct egress from the workload is dropped by the NetworkPolicy, so the paste site is never reached. The supervisor sends traces and OCSF events to the observability stack."
   }
  ]
 },
 "topology": {
  "src": "openshell",
  "title": "Dedicated or shared?",
  "intro": "By default every sandbox gets its own supervisor Pod. With supervisor_topology: gateway, a shared Deployment hosts many. Either way, each sandbox keeps its own policy, identity and gateway session. Shared saves Pods but widens the blast radius. Failover keeps processes, not connections.",
  "steps": [
   {
    "label": "Dedicated, 1:1",
    "text": "Dedicated, 1:1: every sandbox gets its own supervisor pod. The smallest blast radius, and the most pods."
   },
   {
    "label": "Shared, N:1",
    "text": "Shared, N:1: a supervisor deployment hosts many sandboxes, with replicas independent of the gateway count. Each sandbox still has its own policy, credentials and gateway session."
   },
   {
    "label": "Lose a replica",
    "text": "Lose a replica and its sandboxes freeze, but their processes are kept."
   },
   {
    "label": "Takeover",
    "text": "Takeover: the gateway moves them to another replica, fencing and revoking the old owner. The sandboxes resume; their open connections must reconnect."
   },
   {
    "label": "Trade-offs",
    "text": "Trade-offs: dedicated means a pod per sandbox and the smallest failure; shared means fewer pods, but one failure pauses many sandboxes. For shared, run two or more replicas with anti-affinity and a PodDisruptionBudget."
   }
  ]
 },
 "ha": {
  "src": "openshell",
  "title": "An HA control plane",
  "intro": "Run 2+ gateway replicas as a Deployment on PostgreSQL. Each supervisor keeps one session to one replica, which records ownership. Other replicas relay to the owner through a headless peer Service. Scale on CPU. New replicas don't take existing sessions.",
  "steps": [
   {
    "label": "Shared state",
    "text": "Shared state: two or more gateway replicas run as a Deployment on PostgreSQL. Each supervisor keeps one session to one replica, and PostgreSQL records which replica owns it."
   },
   {
    "label": "Peer relay",
    "text": "Peer relay: a request that lands on another replica (an exec into sandbox 1 hitting gateway-1, say) is relayed to the owner through a headless peer Service, authenticated with a pod-bound token."
   },
   {
    "label": "Owner leaves",
    "text": "Owner leaves: a gateway that's stopping redirects its supervisors to other replicas, and the sandbox stays Ready through a few-second handoff."
   },
   {
    "label": "Scale and tenancy",
    "text": "Scale on CPU. Sessions, relay load and peer traffic stay on their owners, so alert on those; new replicas don't take existing sessions. Size PostgreSQL for about 14 connections per gateway pod."
   }
  ]
 },
 "connect": {
  "src": "openshell",
  "title": "Connect Keycloak and SPIFFE",
  "intro": "Keycloak identifies people: the CLI, SDKs and portal sign in with OIDC. SPIFFE identifies workloads: each sandbox gets a short-lived identity to trade for upstream tokens. No long-lived secrets: people carry tokens, sandboxes carry SVIDs.",
  "steps": [
   {
    "label": "Keycloak: set up the realm",
    "text": "Keycloak identifies people. Create a realm with two realm roles, a public client for the CLI that uses Authorization Code with PKCE, and an audience mapper so tokens carry aud: openshell-cli."
   },
   {
    "label": "Point the gateway at it",
    "text": "Point the gateway at the realm. It discovers Keycloak over HTTPS, caches its signing keys (JWKS) and checks iss, aud, exp and sub on every call; roles come from realm_access.roles."
   },
   {
    "label": "Log in from the CLI",
    "text": "Register the gateway once, then log in: the CLI opens a browser and gets the token on a localhost callback. openshell whoami shows the subject that workspace memberships use."
   },
   {
    "label": "SPIFFE: workload identity",
    "text": "SPIFFE identifies workloads, not people. A SPIFFE implementation such as SPIRE gives the gateway and every sandbox Pod an identity in one trust domain, served through a Workload API socket."
   },
   {
    "label": "Tell OpenShell where it is",
    "text": "Give the Kubernetes driver the socket path; it mounts the socket into gateway and sandbox Pods. Token exchange also needs the gateway’s own SVID, which the chart enables with providerTokenGrants.spiffe."
   },
   {
    "label": "Grant short-lived tokens",
    "text": "A provider profile with token_grant makes the supervisor fetch a JWT-SVID, present it to the token endpoint as its OAuth2 client assertion, and add the short-lived token to matching requests. No static secret is stored anywhere."
   }
  ]
 },
 "pwn": {
  "src": "sentry",
  "title": "When the host is compromised",
  "intro": "OpenShell’s supervisor runs on the same host as the agent. With root on that host, an attacker can stop it, rewrite the policy and wipe the logs. The referee has to live where the host can’t reach.",
  "steps": [
   {
    "label": "Get root on the host",
    "text": "Get root on the host. An attacker escapes the container with a kernel exploit and is now uid 0 on the machine that runs both the agent and its supervisor."
   },
   {
    "label": "Take out the supervisor",
    "text": "Take out the supervisor. With root on the host, the attacker stops the supervisor and rewrites the policy to allow everything."
   },
   {
    "label": "Replay the attack",
    "text": "Replay the attack. The same exfiltration now goes out, nobody checks it, and the audit log is wiped. The referee lived on the same host as the attacker."
   }
  ]
 },
 "sentry": {
  "src": "sentry",
  "title": "Raise the Sentry tower",
  "intro": "NVIDIA Sentry moves the network decision onto BlueField-4, with its own CPU and operating system. DOCA Tower enforces the same OpenShell policy. DOCA Argus tells it which program sent each request. Root on the host can’t rewrite either of them.",
  "steps": [
   {
    "label": "Deploy Sentry on BlueField-4",
    "text": "Deploy NVIDIA Sentry on BlueField-4. The policy is pushed to DOCA Tower, which enforces it on the BlueField, and DOCA Argus watches the host's processes from outside. Neither runs on the host."
   },
   {
    "label": "Run the agent",
    "text": "Run the agent. The sandbox's traffic is pinned to one door, its virtual function on the BlueField. Argus names the program behind each request; Tower allows the agent's GET to an approved site."
   },
   {
    "label": "Get root on the host",
    "text": "Get root on the host. Even with uid 0 on the host, the attacker's POST to a paste site is refused by Tower (403), because the decision isn't on the host any more."
   }
  ]
 }
};
