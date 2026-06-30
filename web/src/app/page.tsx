import Link from "next/link";
import { FIRST_SLUG, CURRICULUM } from "@/lib/curriculum";

export default function Home() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-line-2)] px-3 py-1 text-xs text-[var(--color-fg-dim)]">
        🦞 Sandboxed AI agents on Kubernetes
      </div>
      <h1 className="mt-5 text-4xl font-extrabold tracking-tight md:text-5xl">
        Run AI agents safely on <span className="text-[var(--color-nv-bright)]">Kubernetes</span>.
      </h1>
      <p className="mt-5 max-w-2xl text-lg text-[var(--color-fg-dim)]">
        A hands-on teaching site for <strong>OpenShell</strong> — a control plane that turns a
        plain k3s cluster into a fleet of isolated agent sandboxes. Each agent (<strong>OpenClaw 🦞</strong>)
        runs in its own <strong>gVisor</strong> pod, reaches the model through a credential-isolated
        proxy, and is driven from a <strong>live shell right in this page</strong>.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href={`/learn/${FIRST_SLUG}`} className="rounded-lg bg-[var(--color-nv)] px-5 py-2.5 font-semibold text-[#06080b] hover:bg-[var(--color-nv-bright)]">Start learning →</Link>
        <Link href="/learn/deploy" className="rounded-lg border border-[var(--color-line-2)] px-5 py-2.5 font-semibold hover:border-[var(--color-nv)]">Jump to the hands-on labs</Link>
        <Link href="/console" className="rounded-lg border border-[var(--color-line-2)] px-5 py-2.5 font-semibold hover:border-[var(--color-nv)]">Open the OpenShell Console →</Link>
      </div>

      <div className="mt-14 grid gap-4 sm:grid-cols-3">
        {[
          { t: "What you'll learn", d: "How a Sandbox CR becomes a running, isolated agent pod — and how to operate a fleet of them with kubectl and the openshell CLI." },
          { t: "The stack", d: "k3s · gVisor (runsc) · kubernetes-sigs/agent-sandbox · LiteLLM · the OpenShell gateway · OpenClaw — all on one VM." },
          { t: "Hands-on, for real", d: "Every lab runs commands against a live cluster from the terminal embedded in the page. No slides, no mockups." },
        ].map((c) => (
          <div key={c.t} className="rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] p-5">
            <div className="text-sm font-bold text-[var(--color-nv-bright)]">{c.t}</div>
            <div className="mt-1 text-sm text-[var(--color-fg-dim)]">{c.d}</div>
          </div>
        ))}
      </div>

      <h2 className="mt-16 text-lg font-bold tracking-tight">The curriculum</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {CURRICULUM.map((p) => (
          <div key={p.id} className="rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] p-5">
            <div className={`text-sm font-bold ${p.accent === "nv" ? "text-[var(--color-nv-bright)]" : "text-[var(--color-fg)]"}`}>{p.title}</div>
            <div className="mt-1 text-sm text-[var(--color-fg-dim)]">{p.subtitle}</div>
            <ul className="mt-3 space-y-1 text-sm text-[var(--color-fg-mut)]">
              {p.lessons.map((l) => (
                <li key={l.slug}>
                  <Link href={`/learn/${l.slug}`} className="hover:text-[var(--color-nv-bright)]">{l.title}</Link>
                  {l.hasLab && <span className="ml-1 text-[var(--color-nv)]">🧪</span>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </main>
  );
}
