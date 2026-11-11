import Link from "next/link";
import { CURRICULUM, FIRST_SLUG } from "@/lib/curriculum";
import { LearnShell } from "@/components/LearnShell";
import { Figure } from "@/components/Figure";
import { RoadmapCircle, RoadmapTable, STACK } from "@/components/course/Roadmap";

export default function Home() {
  return (
    <LearnShell>
      <div className="mx-auto max-w-6xl">
        <section className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] p-8 md:p-10">
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--color-nv-bright)]">OpenShell on Kubernetes · Hands-on</div>
          <h1 className="mt-3 max-w-3xl text-3xl font-extrabold leading-tight tracking-tight md:text-4xl">
            Run AI agents safely<br />on a Kubernetes cluster
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-relaxed text-[var(--color-fg-dim)]">
            Learn how NVIDIA OpenShell turns a plain cluster into isolated agent sandboxes: deny-by-default
            network policy, credentials the agent never sees, an audit trail of every decision, and people
            signing in with their own roles.
          </p>
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-[var(--color-fg-dim)]">
            You work as the platform operator, the agent developer, the security reviewer and finally the
            SRE. Everything is already deployed on your VM; every lab step has a <strong className="text-[var(--color-fg)]">Run</strong> button
            that executes on it, and the <strong className="text-[var(--color-fg)]">Cluster shell</strong> is there when you want to type.
          </p>
          <Link href={`/learn/${FIRST_SLUG}`} className="mt-7 inline-block rounded-lg bg-[var(--color-nv)] px-5 py-2.5 text-sm font-bold text-[#0a0d07] hover:bg-[var(--color-nv-bright)]">
            Start Module 0 →
          </Link>
        </section>

        <h2 className="mt-12 flex items-center gap-2 text-2xl font-bold"><span className="text-[var(--color-nv-bright)]">›</span> What you will build</h2>
        <p className="mt-4 text-[1.05rem] leading-relaxed text-[var(--color-fg-dim)]">
          A governed agent platform on one VM, and on top of it an SRE copilot: five sealed agents that each
          read exactly one telemetry backend, find the root cause of a real outage together, and recommend a
          fix that a human approves.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-5">
          {[
            ["Seal", "Deny-by-default sandbox"],
            ["Grant", "One host, one method, one path"],
            ["Inject", "Credentials as placeholders"],
            ["Audit", "Every allow and deny"],
            ["Operate", "A fleet that finds root cause"],
          ].map(([t, d]) => (
            <div key={t} className="rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-3">
              <div className="text-sm font-bold text-[var(--color-nv-bright)]">{t}</div>
              <div className="mt-1 text-sm text-[var(--color-fg-dim)]">{d}</div>
            </div>
          ))}
        </div>

        <Figure src="/diagrams/architecture.svg" alt="The lab on one VM: the training site, Keycloak and Grafana; the OpenShell gateway, sandboxes (workload + supervisor pods), LiteLLM and the monitoring stack." caption="The whole lab on one VM" />

        <h2 className="mt-12 flex items-center gap-2 text-2xl font-bold"><span className="text-[var(--color-nv-bright)]">›</span> Your roadmap</h2>
        <p className="mt-4 text-[1.05rem] leading-relaxed text-[var(--color-fg-dim)]">
          One loop around the platform: each module hands the next one something that works. Click a module to start it.
        </p>
        <div className="mt-6 grid items-center gap-6 xl:grid-cols-[360px_1fr]">
          <RoadmapCircle />
          <RoadmapTable />
        </div>

        <h2 className="mt-12 flex items-center gap-2 text-2xl font-bold"><span className="text-[var(--color-nv-bright)]">›</span> Your lab environment</h2>
        <p className="mt-4 text-[1.05rem] leading-relaxed text-[var(--color-fg-dim)]">
          One VM, already built by Ansible when it came up. Nothing to install: every lab reads or changes this stack.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {STACK.map(([n, d]) => (
            <span key={n} className="rounded-full border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-1 text-sm">
              <span className="font-semibold text-[var(--color-fg)]">{n}</span> <span className="text-[var(--color-fg-mut)]">· {d}</span>
            </span>
          ))}
        </div>

        <h2 className="mt-12 flex items-center gap-2 text-2xl font-bold"><span className="text-[var(--color-nv-bright)]">›</span> How the modules fit together</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {CURRICULUM.map((m) => (
            <Link key={m.id} href={`/learn/${m.lessons[0].slug}`} className="rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] p-5 transition hover:border-[var(--color-nv-dim)]">
              <div className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-nv-bright)]">Module {m.n}</div>
              <div className="mt-1 text-lg font-bold">{m.title}</div>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-fg-dim)]">{m.subtitle}</p>
              <div className="mt-3 text-xs text-[var(--color-fg-mut)]">
                {m.lessons.length} lessons · {m.lessons.filter((l) => l.kind === "lab").length} labs · {m.lessons.reduce((a, l) => a + l.minutes, 0)} min
              </div>
            </Link>
          ))}
        </div>

        <section className="mt-12 rounded-2xl border border-[var(--color-nv-dim)] bg-[var(--color-run-bg)] p-8 text-center">
          <h2 className="text-2xl font-bold">Ready?</h2>
          <p className="mx-auto mt-3 max-w-2xl text-[var(--color-fg-dim)]">Module 0 takes about half an hour and needs no commands. The first lab starts in Module 1.</p>
          <Link href={`/learn/${FIRST_SLUG}`} className="mt-6 inline-block rounded-lg bg-[var(--color-nv)] px-5 py-2.5 text-sm font-bold text-[#0a0d07] hover:bg-[var(--color-nv-bright)]">
            Start with Module 0 →
          </Link>
        </section>
      </div>
    </LearnShell>
  );
}
