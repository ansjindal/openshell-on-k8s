// The Overview's roadmap: modules around a circle (you go round once, each
// module feeding the next), then a table of what you do and what you leave with.
import Link from "next/link";
import { CURRICULUM } from "@/lib/curriculum";

export const ROADMAP: Record<string, { doing: string; output: string }> = {
  m0: { doing: "Learn what an agent is, what its harness does, and how one poisoned issue turns it against you.", output: "Why the guardrail has to sit outside the agent." },
  os: { doing: "Each chapter explains one part of OpenShell, then you try it: build and seal an agent, test the sandbox from inside, open egress rule by rule.", output: "A sealed agent with a read-only GitHub rule and an L4 rule." },
  m2: { doing: "Attach a model and your own provider, rotate a key, add a persona and skills, run a task.", output: "An agent that calls a model with a key it cannot read." },
  m3: { doing: "Follow decisions into Loki and Grafana, use the Console, add people and a workspace.", output: "A learner user in their own workspace namespace." },
  m4: { doing: "Bring up five agents, break a service, let the fleet find the cause, approve the fix.", output: "A root cause and a fix you approved; incident-desk at 0% errors." },
  m5: { doing: "Plan high availability, more nodes, tenancy and external credential stores.", output: "Your next steps." },
};

export function RoadmapCircle() {
  const mods = CURRICULUM;
  const R = 150, cx = 230, cy = 200;
  return (
    <svg viewBox="0 0 460 400" className="mx-auto block w-full max-w-[380px]" role="img" aria-label="Course roadmap">
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="var(--color-line-2)" strokeWidth={2} strokeDasharray="6 6" />
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize={15} fontWeight={700} fill="var(--color-fg)">Govern agents</text>
      <text x={cx} y={cy + 14} textAnchor="middle" fontSize={12} fill="var(--color-fg-mut)">on one Kubernetes VM</text>
      {mods.map((m, i) => {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / mods.length;
        const x = cx + R * Math.cos(a), y = cy + R * Math.sin(a);
        return (
          <a key={m.id} href={`/learn/${m.lessons[0].slug}`}>
            <circle cx={x} cy={y} r={30} fill="var(--color-panel-2)" stroke="var(--color-nv)" strokeWidth={2} />
            <text x={x} y={y + 6} textAnchor="middle" fontSize={17} fontWeight={800} fill="var(--color-nv-bright)">{m.n}</text>
            <text x={x} y={y + (Math.sin(a) > 0.3 ? 48 : -40)} textAnchor="middle" fontSize={11.5} fill="var(--color-fg-dim)">{m.title.replace("Capstone: ", "")}</text>
          </a>
        );
      })}
    </svg>
  );
}

export function RoadmapTable() {
  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--color-line)]">
      <table className="w-full text-left text-sm">
        <thead className="bg-[var(--color-panel-2)] text-[var(--color-fg)]">
          <tr><th className="px-4 py-2.5">Module</th><th className="px-4 py-2.5">What you will do</th><th className="px-4 py-2.5">Output</th></tr>
        </thead>
        <tbody>
          {CURRICULUM.map((m) => (
            <tr key={m.id} className="border-t border-[var(--color-line)] align-top">
              <td className="px-4 py-2.5 min-w-[150px]"><Link href={`/learn/${m.lessons[0].slug}`} className="font-semibold text-[var(--color-nv-bright)] hover:underline">{m.n} · {m.title}</Link></td>
              <td className="px-4 py-2.5 text-[var(--color-fg-dim)]">{ROADMAP[m.id]?.doing}</td>
              <td className="px-4 py-2.5 text-[var(--color-fg-dim)]">{ROADMAP[m.id]?.output}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const STACK: [string, string][] = [
  ["k3s v1.37", "Kubernetes"], ["agent-sandbox", "controller"], ["OpenShell 0.1.7", "gateway · supervisors"],
  ["OpenShell Console", "web UI"], ["LiteLLM", "model proxy"], ["Keycloak", "sign-in"],
  ["cert-manager", "mTLS · lab CA"], ["Kyverno", "admission"], ["Prometheus · Grafana", "metrics"],
  ["Loki · Alloy", "logs · OCSF"], ["Tempo", "traces"], ["pi", "the agent"],
];
