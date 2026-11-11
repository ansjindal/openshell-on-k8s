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
    id: "m0", n: 0, title: "Orientation", accent: "nv",
    subtitle: "What you have been handed: one VM running Kubernetes, the OpenShell control plane, sign-in and observability, and why agents need all of it.",
    lessons: [
      L("welcome", "Overview", "What you'll learn, how the labs work, and the one command that builds the stack.", 5),
      L("big-picture", "The big picture", "k3s → agent-sandbox → OpenShell gateway → sandboxes → LiteLLM, with the console on top.", 8),
      L("openshell", "OpenShell: the agent runtime", "Gateway, compute driver, supervisor, providers and workspaces.", 8),
      L("security", "Security: layers, not a wall", "Landlock, seccomp, a supervisor that owns the network, placeholder credentials, an audit trail.", 9),
      L("m0-check", "Summary & knowledge check", "Check what you know about the stack before the labs.", 5, "check"),
    ],
  },
  {
    id: "m1", n: 1, title: "Sandboxes & Policy", accent: "nv", role: "You are the platform operator.",
    subtitle: "You are the platform operator. Verify the cluster, create sandboxes, test the seal from the inside, and open the network one rule at a time.",
    lessons: [
      L("deploy", "Verify the cluster", "Confirm k3s, the gateway, the console and LiteLLM are healthy.", 8, "lab"),
      L("create-sandbox", "Create a sandbox", "openshell sandbox create → a workload pod and a supervisor pod → Ready.", 9, "lab"),
      L("into-the-sandbox", "Into the sandbox", "Exec in and test the seal: filesystem, user, network.", 8, "lab"),
      L("policy", "The seal: egress policy", "Deny by default; grant one endpoint live, then narrow it to GET with an L7 rule.", 10, "lab"),
      L("tcp-egress", "Beyond REST: TCP egress", "An L4 host:port rule for non-HTTP traffic, scoped to one binary.", 6, "lab"),
      L("m1-check", "Summary & knowledge check", "Sandboxes, pods and policies.", 5, "check"),
    ],
  },
  {
    id: "m2", n: 2, title: "Models & Credentials", accent: "nv", role: "You are the agent developer.",
    subtitle: "You are the agent developer. Give agents a model and credentials they never see, shape their persona, install governed skills, and run tasks.",
    lessons: [
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
