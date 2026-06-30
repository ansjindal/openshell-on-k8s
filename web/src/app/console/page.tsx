import Link from "next/link";
import { consoleSession } from "@/lib/console-session";
import { callGateway } from "@/lib/grpc";
import { IconBox, IconProvider, IconInference, IconShield } from "@/components/console/icons";

type Sandbox = { status?: { phase?: string } };

async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try { return await p; } catch { return fallback; }
}

export default async function DashboardPage() {
  const s = await consoleSession();
  const token = s.accessToken;

  const sbResp = await safe(callGateway<{ sandboxes?: Sandbox[] }>("listSandboxes", { limit: 200 }, token), { sandboxes: [] });
  const provResp = await safe(callGateway<{ providers?: unknown[] }>("listProviders", {}, token), { providers: [] });

  const sandboxes = sbResp.sandboxes ?? [];
  const ready = sandboxes.filter((x) => (x.status?.phase || "").includes("READY")).length;
  const providers = (provResp.providers ?? []).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Fleet overview</h1>
          <p>Your OpenShell agent-sandbox fleet at a glance.</p>
        </div>
        {s.isAdmin && (
          <Link href="/console/sandboxes" className="btn"><IconBox width={16} height={16} /> Manage sandboxes</Link>
        )}
      </div>

      <div className="stats">
        <div className="stat">
          <div className="label">Sandboxes</div>
          <div className="value">{sandboxes.length}</div>
          <div className="trend">{ready} ready</div>
        </div>
        <div className="stat">
          <div className="label">Ready</div>
          <div className="value">{ready}<small> / {sandboxes.length}</small></div>
          <div className="trend">{sandboxes.length ? Math.round((ready / sandboxes.length) * 100) : 0}% healthy</div>
        </div>
        <div className="stat">
          <div className="label">Providers</div>
          <div className="value">{providers}</div>
          <div className="trend">attached</div>
        </div>
        <div className="stat">
          <div className="label">Access</div>
          <div className="value" style={{ fontSize: 20, paddingTop: 8 }}>{s.isAdmin ? "Admin" : "Read-only"}</div>
          <div className="trend">open mode</div>
        </div>
      </div>

      <div className="cards">
        <Link href="/console/sandboxes" className="card">
          <div className="ic"><IconBox /></div>
          <h3>Sandboxes</h3>
          <p>Inspect, create, and tear down agent sandboxes across the fleet.</p>
        </Link>
        <Link href="/console/providers" className="card">
          <div className="ic"><IconProvider /></div>
          <h3>Providers</h3>
          <p>Model and inference providers attached to the gateway.</p>
        </Link>
        <Link href="/console/inference" className="card">
          <div className="ic"><IconInference /></div>
          <h3>Inference</h3>
          <p>Routing for <span className="mono">inference.local</span> and token usage.</p>
        </Link>
        <Link href="/console/policies" className="card">
          <div className="ic"><IconShield /></div>
          <h3>Policies</h3>
          <p>Per-sandbox guardrails and draft-policy review.</p>
        </Link>
      </div>
    </>
  );
}
