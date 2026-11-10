// Single source of truth for the site's parts/lessons nav.
// Each lesson maps to src/content/<slug>.mdx. hasLab → renders the live terminal.
export type Lesson = { slug: string; title: string; blurb: string; minutes: number; hasLab?: boolean };
export type Part = { id: string; title: string; subtitle: string; accent?: "rh" | "nv"; lessons: Lesson[] };

export const CURRICULUM: Part[] = [
  {
    id: "intro",
    title: "Part I · Orientation",
    subtitle: "What this is and how the stack fits together",
    accent: "nv",
    lessons: [
      { slug: "welcome", title: "Welcome", blurb: "What you'll learn, and the one command that brings up the whole stack.", minutes: 5 },
      { slug: "big-picture", title: "The Big Picture", blurb: "k3s → agent-sandbox → OpenShell gateway → sandboxes → LiteLLM, and the console on top.", minutes: 8 },
      { slug: "openshell", title: "OpenShell: The Agent Runtime", blurb: "Gateway, compute driver, supervisor, providers and workspaces: the pieces of OpenShell 0.1.", minutes: 8 },
      { slug: "security", title: "Security: Layers, Not a Wall", blurb: "Landlock, seccomp, a supervisor that owns the network, credentials as placeholders, an audit trail.", minutes: 9 },
    ],
  },
  {
    id: "handson",
    title: "Part II · Hands-on",
    subtitle: "Drive the real cluster from the live shell",
    accent: "nv",
    lessons: [
      { slug: "deploy", title: "Verify the Cluster", blurb: "Ansible already provisioned everything; confirm k3s, the gateway, the console and LiteLLM are healthy.", minutes: 8, hasLab: true },
      { slug: "create-sandbox", title: "Create a Sandbox", blurb: "The sandbox lifecycle: openshell sandbox create → a workload pod and a supervisor pod → Ready.", minutes: 9, hasLab: true },
      { slug: "into-the-sandbox", title: "Into the Sandbox", blurb: "Exec in and test the seal from the inside: filesystem, user, network.", minutes: 8, hasLab: true },
      { slug: "policy", title: "The Seal: Egress Policy", blurb: "Deny by default; grant one endpoint live, then narrow it to GET with an L7 rule.", minutes: 10, hasLab: true },
      { slug: "tcp-egress", title: "Beyond REST: Direct TCP Egress", blurb: "Not everything is HTTP: an L4 host:port rule for non-REST traffic, and what you give up.", minutes: 6, hasLab: true },
      { slug: "inference", title: "Models Through a Provider", blurb: "The litellm provider: a placeholder key in the sandbox, the real key injected on allowed calls only.", minutes: 9, hasLab: true },
      { slug: "providers", title: "Your Own Provider", blurb: "Write a provider profile, attach it live, watch the real credential arrive upstream, rotate it.", minutes: 10, hasLab: true },
      { slug: "workspace", title: "Give It a Soul: Workspace Files", blurb: "IDENTITY/SOUL/BOOTSTRAP Markdown shape the agent; seed and customize them.", minutes: 8, hasLab: true },
      { slug: "skills", title: "Skills: Governed Capabilities", blurb: "Install skills from your in-cluster registry only, with a policy scoped to npm installs.", minutes: 12, hasLab: true },
      { slug: "run-a-task", title: "Run a Task", blurb: "Hand the agent a prompt and read what it did.", minutes: 8, hasLab: true },
      { slug: "audit", title: "The Audit Trail", blurb: "Every allow and deny as an OCSF event: in the CLI, in Loki and in Grafana; agent traces in Tempo.", minutes: 9, hasLab: true },
      { slug: "console", title: "The OpenShell Console", blurb: "The upstream web console: sandboxes, logs, terminal, policy revisions and the draft inbox.", minutes: 8, hasLab: true },
      { slug: "access-control", title: "Users, Roles & Workspaces", blurb: "Keycloak identities on the gateway: an admin and a user, workspaces and membership.", minutes: 10, hasLab: true },
    ],
  },
  {
    id: "build",
    title: "Part III · Build Something Useful",
    subtitle: "The capstone: an SRE copilot fleet that investigates a real incident",
    accent: "nv",
    lessons: [
      { slug: "what-youll-build", title: "The Challenge: An SRE Copilot Fleet", blurb: "Sealed agents (logs, metrics, traces, events), each scoped read-only to one backend, combined by a lead analyst to find the root cause.", minutes: 8 },
      { slug: "fleet-spinup", title: "Spin Up & Give Each a Soul", blurb: "One command brings the fleet up; each agent gets its own IDENTITY/SOUL, a skill, and a policy scoped to just its tool.", minutes: 10, hasLab: true },
      { slug: "fleet-status", title: "The Fleet, at a Glance", blurb: "One page: every agent's status, the exact egress its policy allows, and its SOUL.", minutes: 6, hasLab: true },
      { slug: "incident-lab", title: "Orchestrate & Resolve an Incident", blurb: "An instrumented app + loadgen; inject a fault, watch the live numbers, let the fleet investigate and recommend a fix you approve.", minutes: 14, hasLab: true },
      { slug: "orchestration", title: "Under the Hood: How It's Orchestrated", blurb: "The real code and prompts behind the fleet: the fixed plan, each agent's probe, the telemetry skill, the analyst's synthesis.", minutes: 10 },
      { slug: "build-your-own", title: "Build Your Own", blurb: "The fleet is a pattern: new agents, faults and skills to extend it with, on your own.", minutes: 8 },
    ],
  },
  {
    id: "next",
    title: "Part IV · Going Further",
    subtitle: "Where to take it next",
    lessons: [
      { slug: "next-steps", title: "Next Steps & Resources", blurb: "Multi-node, PostgreSQL + HA, other agents, and where to go deeper.", minutes: 6 },
    ],
  },
];

export const ALL_LESSONS: (Lesson & { partId: string; partTitle: string })[] =
  CURRICULUM.flatMap((p) => p.lessons.map((l) => ({ ...l, partId: p.id, partTitle: p.title })));

export function lessonNeighbors(slug: string) {
  const i = ALL_LESSONS.findIndex((l) => l.slug === slug);
  return {
    prev: i > 0 ? ALL_LESSONS[i - 1] : null,
    next: i >= 0 && i < ALL_LESSONS.length - 1 ? ALL_LESSONS[i + 1] : null,
    current: i >= 0 ? ALL_LESSONS[i] : null,
  };
}

export const FIRST_SLUG = ALL_LESSONS[0]?.slug ?? "welcome";
