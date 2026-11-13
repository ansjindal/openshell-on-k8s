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
    subtitle: "What an agent is, then build one and deploy it on Kubernetes the usual way, and see what it can reach.",
    lessons: [
      L("welcome", "Overview", "What you'll learn, how the labs work, and the one command that builds the stack.", 5),
      L("what-is-an-agent", "What is an agent?", "A model in a ReAct loop, plus the knowledge it reads, the tools it calls, the skills it loads and the harness that runs it all.", 6),
      L("cluster-and-model", "Your Kubernetes cluster and LiteLLM", "The Kubernetes cluster on your VM, and LiteLLM configured with your inference endpoint.", 8, "lab"),
      L("agent-on-k8s", "Deploy an agent on Kubernetes", "An agent built with pi, as an ordinary Deployment with the LiteLLM key in a Secret, and what it can reach from inside the cluster.", 12, "lab"),
      L("agent-misled", "When an agent is misled", "One poisoned issue, what it touches, and where the guardrail should live.", 6),
    ],
  },
  {
    id: "os", n: 1, title: "OpenShell", accent: "nv", role: "You are the platform operator.",
    subtitle: "The overview introduces OpenShell; then the labs, each explaining its part before you run it: verify OpenShell, give sandboxes a model through a provider, seal the pi agent from Module 0, and open its network rule by rule.",
    lessons: [
      L("openshell", "Overview", "What OpenShell is, the same agent inside it, how it is built (gateway, supervisor, sandbox), and NVIDIA Sentry.", 15),
      L("deploy", "Verify OpenShell", "OpenShell on Kubernetes and this lab's platform: the control plane, the gateway and who you are to it, the first sandbox.", 8, "lab"),
      L("inference", "Give agents a model: the litellm provider", "A provider holds LiteLLM's key; a sandbox gets a placeholder, and the real key goes only on allowed calls.", 8, "lab"),
      L("build-an-agent", "Seal the agent", "openshell sandbox create, flag by flag; the pods and NetworkPolicy it makes; the seal tested from inside; one door opened for npm; pi run sealed.", 20, "lab"),
      L("policy", "Open its network, rule by rule", "Live rules on the running sandbox: GET allowed and POST refused at L7, a plain TCP rule for one host and one program, revisions.", 15, "lab"),
      L("os-check", "Summary & knowledge check", "Agents, OpenShell, providers, sandboxes and policies.", 8, "check"),
    ],
  },
  {
    id: "m2", n: 2, title: "Customize & operate agents", accent: "nv", role: "You are the agent developer, then the security reviewer.",
    subtitle: "Customize agents with your own credentials, a persona, governed skills and real tasks; then operate them: read the audit trail, use the web console, and give people roles and workspaces.",
    lessons: [
      L("m2-overview", "Overview", "What this module builds: your own provider, a persona, skills, tasks, then the audit trail, the console and people with roles.", 5),
      L("providers", "Your own provider", "Write a profile, attach it live, watch the real token arrive upstream, rotate it.", 10, "lab"),
      L("workspace", "Give it a soul: workspace files", "IDENTITY/SOUL/BOOTSTRAP Markdown shape the agent.", 8, "lab"),
      L("skills", "Skills: governed capabilities", "Install skills from your in-cluster registry only, with a policy scoped to npm.", 12, "lab"),
      L("run-a-task", "Run a task", "The fleet helper, then hand agents a prompt and read what they did.", 8, "lab"),
      L("audit", "The audit trail", "Every allow and deny as an OCSF event: CLI, Loki, Grafana; agent traces in Tempo.", 10, "lab"),
      L("console", "The OpenShell Console", "Sandboxes, logs, terminal, policy revisions and the proposals inbox.", 8, "lab"),
      L("access-control", "Users, roles & workspaces", "Keycloak identities on the gateway: an admin, a user, a workspace.", 10, "lab"),
      L("m2-check", "Summary & knowledge check", "Providers, persona, skills, audit, identities and workspaces.", 8, "check"),
    ],
  },
  {
    id: "m4", n: 3, title: "Capstone: SRE Copilot Fleet", accent: "nv", role: "You are the SRE.",
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
    id: "m5", n: 4, title: "Going Further",
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
