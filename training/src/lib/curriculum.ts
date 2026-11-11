// Single source of truth for the course: modules and their lessons.
// Each lesson maps to src/content/<slug>.mdx. kind: "read" (concepts), "lab"
// (hands-on, runs commands on your VM) or "check" (summary + knowledge check).
export type LessonKind = "read" | "lab" | "check";
export type Lesson = { slug: string; title: string; blurb: string; minutes: number; kind: LessonKind; hasLab?: boolean };
export type Part = { id: string; n: number; title: string; subtitle: string; role?: string; accent?: "rh" | "nv"; lessons: Lesson[] };

const L = (slug: string, title: string, blurb: string, minutes: number, kind: LessonKind = "read"): Lesson =>
  ({ slug, title, blurb, minutes, kind, hasLab: kind === "lab" });

export const CURRICULUM: Part[] = [
  {
    id: "m0", n: 0, title: "Agents", accent: "nv",
    subtitle: "What an AI agent is, the harness that runs it, and why the guardrail has to sit outside it.",
    lessons: [
      L("welcome", "Overview", "What you'll learn, how the labs work, and the one command that builds the stack.", 5),
      L("what-is-an-agent", "What is an agent?", "A model in a ReAct loop, plus the knowledge it reads, the tools it calls, the skills it loads and the harness that runs it all.", 8),
      L("agent-misled", "When an agent is misled", "One poisoned issue, what it touches, and where the guardrail should live.", 8),
    ],
  },
  {
    id: "os", n: 1, title: "OpenShell", accent: "nv", role: "You are the platform operator.",
    subtitle: "The overview explains OpenShell one topic at a time; then the labs, one by one: check your environment, build an agent, seal it, and open its network rule by rule.",
    lessons: [
      L("openshell", "Overview", "OpenShell one topic at a time: the sandbox, gateway and supervisor, kernel, policy, keys, audit, Kubernetes, Sentry.", 40),
      L("deploy", "Verify your cluster", "Kubernetes first, then OpenShell: the node, the control plane, the gateway, your identity, the first sandbox.", 8, "lab"),
      L("build-an-agent", "Build an agent and seal it", "pi on the VM, connected to your model; then the same agent in a sandbox, connected again through the provider.", 20, "lab"),
      L("create-sandbox", "Create a sandbox", "openshell sandbox create, and the workload and supervisor pods it makes.", 9, "lab"),
      L("into-the-sandbox", "Test the seal from inside", "Exec in: the sandbox user, Landlock, and a network that only reaches the supervisor.", 8, "lab"),
      L("policy", "Egress policy, rule by rule", "Deny by default; grant one endpoint live, then narrow it to GET with an L7 rule.", 10, "lab"),
      L("tcp-egress", "TCP egress", "An L4 host:port rule for non-HTTP traffic, scoped to one binary.", 6, "lab"),
      L("lab-keys", "A key the agent doesn't hold", "The placeholder in agent-0, a model call with it, and the admin API refused.", 6, "lab"),
      L("lab-audit", "Read the audit events", "Make a few denials and read each one as an OCSF event.", 6, "lab"),
      L("os-check", "Summary & knowledge check", "Agents, OpenShell, sandboxes and policies.", 8, "check"),
    ],
  },
  {
    id: "m2", n: 2, title: "Models & Credentials", accent: "nv", role: "You are the agent developer.",
    subtitle: "You are the agent developer. Give agents a model and credentials they never see, shape their persona, install governed skills, and run tasks.",
    lessons: [
      L("m2-overview", "Overview", "What this module builds: a model, credentials the agent never sees, skills and a task.", 4),
      L("inference", "Models through a provider", "The litellm provider: a placeholder key in the sandbox, the real key injected on allowed calls only.", 9, "lab"),
      L("providers", "Your own provider", "Write a profile, attach it live, watch the real token arrive upstream, rotate it.", 10, "lab"),
      L("workspace", "Give it a soul: workspace files", "IDENTITY/SOUL/BOOTSTRAP Markdown shape the agent.", 8, "lab"),
      L("skills", "Skills: governed capabilities", "Install skills from your in-cluster registry only, with a policy scoped to npm.", 12, "lab"),
      L("run-a-task", "Run a task", "Hand the agent a prompt and read what it did.", 8, "lab"),
      L("m2-check", "Summary & knowledge check", "Providers, placeholders and skills.", 5, "check"),
    ],
  },
  {
    id: "m3", n: 3, title: "Audit, Console & Access", accent: "nv", role: "You are the security reviewer.",
    subtitle: "You are the security reviewer. Read the audit trail, drive the same gateway from the web console, and give people roles and workspaces.",
    lessons: [
      L("m3-overview", "Overview", "What this module builds: an audit trail, the web console and people with roles.", 4),
      L("audit", "The audit trail", "Every allow and deny as an OCSF event: CLI, Loki, Grafana; agent traces in Tempo.", 9, "lab"),
      L("console", "The OpenShell Console", "Sandboxes, logs, terminal, policy revisions and the proposals inbox.", 8, "lab"),
      L("access-control", "Users, roles & workspaces", "Keycloak identities on the gateway: an admin, a user, a workspace.", 10, "lab"),
      L("m3-check", "Summary & knowledge check", "Audit, identities and workspaces.", 5, "check"),
    ],
  },
  {
    id: "m4", n: 4, title: "Capstone: SRE Copilot Fleet", accent: "nv", role: "You are the SRE.",
    subtitle: "You are the SRE. Bring up a fleet of sealed specialists, break a real service, let the fleet find the root cause, and approve the fix yourself.",
    lessons: [
      L("m4-overview", "Overview", "What this module builds: a fleet of sealed specialists that finds a real fault.", 4),
      L("what-youll-build", "The challenge", "Sealed agents for logs, metrics, traces and events, combined by an analyst.", 8),
      L("fleet-spinup", "Spin up the fleet", "One command: five agents, each with a persona, a skill and a policy scoped to its tool.", 10, "lab"),
      L("fleet-status", "The fleet at a glance", "Every agent's status, the exact egress its policy allows, and its SOUL.", 6, "lab"),
      L("incident-lab", "Investigate an incident", "Break a dependency, let the fleet investigate, approve the fix.", 14, "lab"),
      L("orchestration", "Under the hood", "The code and prompts behind the fleet: the plan, the probes, the synthesis.", 10),
      L("build-your-own", "Build your own", "New agents, faults and skills to extend the fleet.", 8),
      L("m4-check", "Summary & knowledge check", "The capstone, end to end.", 5, "check"),
    ],
  },
  {
    id: "m5", n: 5, title: "Going Further",
    subtitle: "Where to take it next: high availability, more nodes, a namespace per team, credentials in Vault.",
    lessons: [
      L("next-steps", "Next steps & resources", "HA, multi-node, tenancy, credential drivers, other agents.", 6),
    ],
  },
];

export const ALL_LESSONS: (Lesson & { partId: string; partTitle: string; moduleN: number; number: string })[] =
  CURRICULUM.flatMap((p) => p.lessons.map((l, i) => ({
    ...l, partId: p.id, partTitle: `Module ${p.n} · ${p.title}`, moduleN: p.n, number: `${p.n}.${i + 1}`,
  })));

export function lessonNeighbors(slug: string) {
  const i = ALL_LESSONS.findIndex((l) => l.slug === slug);
  return {
    prev: i > 0 ? ALL_LESSONS[i - 1] : null,
    next: i >= 0 && i < ALL_LESSONS.length - 1 ? ALL_LESSONS[i + 1] : null,
    current: i >= 0 ? ALL_LESSONS[i] : null,
  };
}

export const FIRST_SLUG = ALL_LESSONS[0]?.slug ?? "welcome";
