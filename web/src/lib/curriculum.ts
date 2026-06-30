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
      { slug: "big-picture", title: "The Big Picture", blurb: "k3s → gVisor → agent-sandbox → LiteLLM → OpenShell gateway → OpenClaw.", minutes: 8 },
      { slug: "openshell", title: "OpenShell: The Agent Runtime", blurb: "The control plane: gateway, compute driver, supervisor, inference router.", minutes: 8 },
      { slug: "security", title: "Security: Isolation & Credentials", blurb: "gVisor kernel isolation, credential-isolated inference, Kyverno guardrails.", minutes: 9 },
    ],
  },
  {
    id: "handson",
    title: "Part II · Hands-on",
    subtitle: "Drive the real cluster from the live shell",
    accent: "nv",
    lessons: [
      { slug: "deploy", title: "Verify the Cluster", blurb: "Ansible already provisioned everything — confirm k3s, the gateway, and the model endpoint are healthy.", minutes: 8, hasLab: true },
      { slug: "create-sandbox", title: "Create a Sandbox", blurb: "The agent lifecycle: openshell sandbox create / ./scripts/fleet up → Ready.", minutes: 9, hasLab: true },
      { slug: "into-the-sandbox", title: "Into the Sandbox", blurb: "Exec into an agent — a sandbox IS a gVisor pod.", minutes: 8, hasLab: true },
      { slug: "policy", title: "The Seal: Egress Policy", blurb: "Deny-by-default network policy — see what a sandbox may reach, and grant an endpoint.", minutes: 8, hasLab: true },
      { slug: "inference", title: "Inference Routing", blurb: "How inference.local reaches LiteLLM, and how to change the model.", minutes: 8, hasLab: true },
      { slug: "workspace", title: "Give It a Soul: Workspace Files", blurb: "IDENTITY/SOUL/BOOTSTRAP Markdown shape the agent — seed and customize them.", minutes: 8, hasLab: true },
      { slug: "skills", title: "Skills: Governed Capabilities", blurb: "Install from ClawHub (gated, per-package) vs your in-cluster registry (the locked single source); publish your own.", minutes: 12, hasLab: true },
      { slug: "run-a-task", title: "Run a Task", blurb: "Hand the fleet a prompt and read the logs.", minutes: 8, hasLab: true },
      { slug: "console", title: "The Console", blurb: "The embedded OpenShell Console — sandboxes, policies, and inference in the browser, same gateway as the CLI.", minutes: 6, hasLab: true },
    ],
  },
  {
    id: "build",
    title: "Part III · Build Something Useful",
    subtitle: "The capstone: an SRE copilot fleet that investigates a real incident",
    accent: "nv",
    lessons: [
      { slug: "what-youll-build", title: "The Challenge: An SRE Copilot Fleet", blurb: "Four sealed agents — logs, metrics, traces, events — each scoped to one backend, combined by a lead analyst to find root cause.", minutes: 8 },
      { slug: "fleet-spinup", title: "Spin Up & Give Each a Soul", blurb: "One command brings the fleet up; each agent gets its own IDENTITY/SOUL, a skill, and a policy scoped to just its tool.", minutes: 10, hasLab: true },
      { slug: "fleet-status", title: "The Fleet, at a Glance", blurb: "One page: every agent's status, the exact egress its policy allows, and its SOUL.", minutes: 6, hasLab: true },
      { slug: "incident-lab", title: "Orchestrate & Resolve an Incident", blurb: "An instrumented app + loadgen; inject an app fault, watch the live numbers, let the fleet investigate and recommend a remediation you approve.", minutes: 14, hasLab: true },
      { slug: "orchestration", title: "Under the Hood: How It's Orchestrated", blurb: "The real code and prompts behind the fleet — the fixed plan, each agent's prescribed probe, the cluster-telemetry skill, and the analyst's synthesis. Nothing hidden.", minutes: 10 },
      { slug: "build-your-own", title: "Build Your Own", blurb: "The fleet is a pattern, not a fixed thing — concrete new agents, faults, and skills to extend it with, on your own.", minutes: 8 },
    ],
  },
  {
    id: "production",
    title: "Part IV · The Incident Desk",
    subtitle: "A real backend app: a governed incident-response fleet, end to end",
    accent: "rh",
    lessons: [
      { slug: "incident-desk", title: "The Incident Desk", blurb: "A real backend app driving a 7-agent governed fleet — each sealed to one telemetry backend — through two human gates to one of two remediation paths, incl. GitOps.", minutes: 12 },
    ],
  },
  {
    id: "ui-agent",
    title: "Part V · The Governed UI Agent",
    subtitle: "An interactive OpenClaw Control UI as a sealed agent — give it a soul, restart it, pair your browser",
    accent: "nv",
    lessons: [
      { slug: "openclaw-ui", title: "The Governed UI Agent & Approvals", blurb: "An interactive OpenClaw Control UI as a sealed agent, reached via an openshell-forward bridge; device pairing, the scope-upgrade deadlock, and the one-click Enable-approvals bootstrap.", minutes: 10 },
      { slug: "openclaw-soul", title: "Give It a Soul", blurb: "The workspace .md files (IDENTITY/SOUL/BOOTSTRAP) that shape your pre-provisioned UI agent — inspect and edit them live; staging new ones takes a gateway restart.", minutes: 9, hasLab: true },
      { slug: "openclaw-approvals", title: "Restart & Approve", blurb: "How the gateway is (re)started and how the host supervisor keeps it alive — then pair your browser: the scope-upgrade deadlock and the one-click bootstrap that breaks it.", minutes: 9, hasLab: true },
    ],
  },
  {
    id: "next",
    title: "Part VI · Going Further",
    subtitle: "Where to take it next",
    lessons: [
      { slug: "next-steps", title: "Next Steps & Resources", blurb: "Multi-node, monitoring, other agents, and where to go deeper.", minutes: 6 },
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
