import { Approvals } from "@/components/Approvals";

export const metadata = { title: "Device Approvals · OpenShell on Kubernetes" };
export const dynamic = "force-dynamic";

export default function ApprovalsPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-8">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-fg-mut)]">Operator · human-in-the-loop control</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight text-[var(--color-fg)]">Approvals</h1>
      <p className="mt-2 max-w-2xl text-sm text-[var(--color-fg-mut)]">
        Gated by you. When a browser or CLI asks to pair with the OpenClaw <strong>Control UI</strong>, its pairing request lands here — approve or deny it.
        First, <strong>Enable approvals</strong> grants the operator device the admin scopes it needs to approve at all (the one-time fix for the fresh-gateway &ldquo;scope upgrade pending&rdquo; deadlock).
      </p>
      <Approvals />
    </main>
  );
}
