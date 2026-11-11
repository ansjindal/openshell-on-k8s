import Link from "next/link";
import { CURRICULUM, FIRST_SLUG } from "@/lib/curriculum";
import { LearnShell } from "@/components/LearnShell";
import { RoadmapCircle, RoadmapTable, STACK } from "@/components/course/Roadmap";

export default function Home() {
  return (
    <LearnShell>
      <div className="w-full">
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
        <p className="mt-4 text-[16px] leading-[25.6px] text-[var(--color-fg-dim)]">
          This course assumes you have never used OpenShell. You start with an ordinary AI agent, see what it can
          do when nothing stops it, and then put <strong className="text-[var(--color-fg)]">NVIDIA OpenShell</strong> around it, one layer at a time.
          By the end you run a small team of agents on a real outage, each one boxed in, and every move it makes on record.
        </p>

        <h3 className="mt-8 text-[17px] font-bold text-[var(--color-fg)]">Why an agent needs a boundary</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {[
            ["It acts on its own", "A model only answers. An agent is a model plus a harness that runs tools for it (a shell, a browser, an API client) in a loop, toward a goal, for minutes or hours."],
            ["It works with real access", "To be useful it gets real credentials and a network. Without a boundary it can reach anything its machine can, and read every key it was given."],
            ["It can be talked into things", "Agents act on what they read and can't always tell data from instructions. One hidden line on a web page can turn a helpful agent against you."],
          ].map(([t, d]) => (
            <div key={t} className="rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-3">
              <div className="text-[14px] font-bold text-[var(--color-fg)]">{t}</div>
              <p className="mt-1 text-[13.5px] leading-[21px] text-[var(--color-fg-dim)]">{d}</p>
            </div>
          ))}
        </div>

        <h3 className="mt-8 text-[17px] font-bold text-[var(--color-fg)]">What OpenShell does about it</h3>
        <p className="mt-2 text-[16px] leading-[25.6px] text-[var(--color-fg-dim)]">
          OpenShell is open-source software that runs each agent in its own <strong className="text-[var(--color-fg)]">sandbox</strong>.
          The agent is locked in (files, processes, no direct network), and a trusted <strong className="text-[var(--color-fg)]">supervisor</strong> next
          to it decides every connection against a short <strong className="text-[var(--color-fg)]">policy</strong>{" "}file: anything the policy doesn&apos;t
          allow is denied. API keys stay outside the sandbox and are added only to the requests the policy allows, and every
          decision is written to an <strong className="text-[var(--color-fg)]">audit</strong> log. The boundary sits outside the model and the agent, so it works
          with any of them. It runs on any Linux host; in this course, on Kubernetes.
        </p>

        <h3 className="mt-8 text-[17px] font-bold text-[var(--color-fg)]">What you&apos;ll do here, step by step</h3>
        <div className="mt-3 flex flex-col gap-2 lg:flex-row lg:items-stretch">
          {[
            ["Understand", "what-is-an-agent", "Module 0", "See what an agent is, what its harness does with your access, and how one poisoned issue turns it against you."],
            ["Seal", "build-an-agent", "Module 1", "Build an agent, then put it in an OpenShell sandbox: nothing gets out by default, and you test that from inside."],
            ["Grant", "policy", "Module 1", "Open exactly one door while it runs: one host, one HTTP method, one path, one program."],
            ["Inject", "m2-overview", "Module 2", "Give it a model and an API key it never actually holds: the sandbox only sees a placeholder."],
            ["Audit", "m3-overview", "Module 3", "Follow every allow and deny in Grafana, use the web console, and give people their own roles and workspaces."],
            ["Operate", "m4-overview", "Module 4", "Run five sealed agents that each read one telemetry source, find a real outage's root cause, and propose a fix you approve."],
          ].map(([t, slug, mod, d], i, all) => (
            <div key={t} className="flex flex-1 items-stretch gap-2">
              <Link href={`/learn/${slug}`} className="group flex flex-1 flex-col rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)] px-3.5 py-3 transition hover:border-[var(--color-nv-dim)]">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-nv)] text-[11px] font-extrabold text-[#0b0f05]">{i + 1}</span>
                  <span className="text-[14px] font-bold text-[var(--color-nv-bright)]">{t}</span>
                  <span className="ml-auto whitespace-nowrap text-[11px] text-[var(--color-fg-mut)]">{mod}</span>
                </div>
                <p className="mt-1.5 flex-1 text-[13px] leading-[19.5px] text-[var(--color-fg-dim)] group-hover:text-[var(--color-fg)]">{d}</p>
              </Link>
              {i < all.length - 1 && <span className="hidden items-center text-[var(--color-fg-mut)] lg:flex">→</span>}
            </div>
          ))}
        </div>
        <p className="mt-3 text-[13px] text-[var(--color-fg-mut)]">
          Everything runs on one VM that is already set up for you. Each lab step has a Run button that runs it there, and the Cluster shell at the bottom of the page is a real shell on it.
        </p>

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
          <p className="mx-auto mt-3 max-w-2xl text-[var(--color-fg-dim)]">Module 0 takes about twenty minutes and needs no commands: you play animated scenes. Module 1 opens with an overview of OpenShell, then the labs, one by one, on your VM.</p>
          <Link href={`/learn/${FIRST_SLUG}`} className="mt-6 inline-block rounded-lg bg-[var(--color-nv)] px-5 py-2.5 text-sm font-bold text-[#0a0d07] hover:bg-[var(--color-nv-bright)]">
            Start with Module 0 →
          </Link>
        </section>
      </div>
    </LearnShell>
  );
}
