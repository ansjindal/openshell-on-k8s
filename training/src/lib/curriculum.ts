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
    subtitle: "The runtime that puts the boundary outside the agent. Each chapter explains one part with the talks' scenes, then you try it on your VM.",
    lessons: [
      L("openshell", "Enter OpenShell", "The boundary outside the agent; then build an agent with pi and run the same agent sealed in a sandbox.", 25, "lab"),
      L("os-architecture", "Gateway and supervisor", "The control plane and a supervisor per sandbox; then create a sandbox and find its two halves.", 20, "lab"),
      L("os-kernel", "Inside the sandbox: the kernel", "seccomp, Landlock and the sandbox user; then test the seal from inside.", 20, "lab"),
      L("security", "The policy file", "One YAML file, two lifetimes; then open the network rule by rule, REST and TCP.", 25, "lab"),
      L("request-flow", "One request, end to end", "The checkpoints a request passes and why the agent never holds the key; then see it on agent-0.", 15, "lab"),
      L("audit-signals", "Signals and audit events", "Traces, metrics and OCSF events on one sandbox ID; then read the events your requests made.", 15, "lab"),
      L("big-picture", "OpenShell on Kubernetes: this lab", "One sandbox on Kubernetes, this lab's platform path by path; then verify your cluster.", 20, "lab"),
      L("sentry", "NVIDIA Sentry: beyond the host", "When the host itself is compromised: the same policy, enforced on BlueField-4.", 6),
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
