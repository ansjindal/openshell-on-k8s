import Link from "next/link";
import { publicBaseUrl } from "@/lib/public-base";

// Derive the base from the ACTUAL request host at request time, so links point at
// wherever the user really is (launchpad, brevlab, …) instead of a possibly-stale
// baked PUBLIC_BASE_URL. Must stay dynamic — headers() opts the route out of static.
export const dynamic = "force-dynamic";

type L = { name: string; href: string; desc: string; ext?: boolean; off?: boolean };

function platformLinks(base: string): L[] {
  return [
    { name: "OpenShell Console", href: "/console", desc: "Fleet & sandbox management — list/create sandboxes, view policy, logs, terminal. Part of this site." },
    { name: "Grafana", href: base ? `${base}/grafana` : "/grafana", desc: "Dashboards & metrics (Prometheus + Loki + Tempo). Behind the Envoy ingress; SSO via Keycloak.", ext: true, off: !base },
    { name: "Keycloak", href: base ? `${base}/auth` : "/auth", desc: "Single sign-on / identity. Admin console + the openshell realm.", ext: true, off: !base },
  ];
}

const docs: L[] = [
  { name: "NVIDIA OpenShell", href: "https://docs.nvidia.com/openshell/", desc: "The agent control plane: gateway, sandboxes, inference routing.", ext: true },
  { name: "agent-sandbox", href: "https://github.com/kubernetes-sigs/agent-sandbox", desc: "The upstream Sandbox CRD + controller this builds on.", ext: true },
  { name: "LiteLLM", href: "https://github.com/BerriAI/litellm", desc: "The OpenAI-compatible proxy in front of the model.", ext: true },
  { name: "gVisor", href: "https://gvisor.dev/", desc: "The runsc kernel sandbox every agent pod runs under.", ext: true },
  { name: "Kyverno", href: "https://kyverno.io/", desc: "Policy guardrails (require-gvisor + sandbox rules).", ext: true },
  { name: "k3s", href: "https://k3s.io/", desc: "The single-binary Kubernetes this runs on.", ext: true },
];

function Card({ l }: { l: L }) {
  const inner = (
    <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] p-5 transition hover:border-[var(--color-nv)]">
      <div className="flex items-center gap-2 text-sm font-bold text-[var(--color-nv-bright)]">
        {l.name}
        {l.ext && <span className="text-[var(--color-fg-mut)]">↗</span>}
        {l.off && <span className="rounded-full border border-[var(--color-line-2)] px-2 py-0.5 text-[0.65rem] font-normal text-[var(--color-fg-mut)]">set PUBLIC_BASE_URL</span>}
      </div>
      <div className="mt-1 text-sm text-[var(--color-fg-dim)]">{l.desc}</div>
      <div className="mt-2 truncate text-xs text-[var(--color-fg-mut)]">{l.href}</div>
    </div>
  );
  if (l.href.startsWith("http") || l.ext) return <a href={l.href} target="_blank" rel="noreferrer">{inner}</a>;
  return <Link href={l.href}>{inner}</Link>;
}

export default async function LinksPage() {
  const base = await publicBaseUrl();
  const platform = platformLinks(base);
  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-3xl font-extrabold tracking-tight">Links</h1>
      <p className="mt-3 max-w-2xl text-[var(--color-fg-dim)]">
        Everything deployed on this cluster, plus where to go deeper.
      </p>

      <h2 className="mt-10 text-lg font-bold tracking-tight">Platform UIs</h2>
      {!base && (
        <p className="mt-2 text-sm text-[var(--color-fg-mut)]">
          Grafana / Headlamp / Keycloak sit behind the Envoy ingress on the node&apos;s port 30080.
          Expose that port on Brev and set <code>PUBLIC_BASE_URL</code> for the teaching-site service
          to turn these into working absolute links.
        </p>
      )}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {platform.map((l) => <Card key={l.name} l={l} />)}
      </div>

      <h2 className="mt-12 text-lg font-bold tracking-tight">Docs & projects</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {docs.map((l) => <Card key={l.name} l={l} />)}
      </div>
    </main>
  );
}
