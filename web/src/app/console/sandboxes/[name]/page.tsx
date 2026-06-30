import Link from "next/link";
import { consoleSession } from "@/lib/console-session";
import { callGateway } from "@/lib/grpc";
import { SandboxDetail } from "./SandboxDetail";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

async function safe<T>(p: Promise<T>): Promise<T | null> {
  try { return await p; } catch { return null; }
}

export default async function SandboxDetailPage({ params, searchParams }: { params: Promise<{ name: string }>; searchParams: Promise<{ tab?: string }> }) {
  const s = await consoleSession();
  const token = s.accessToken;
  const { name: rawName } = await params;
  const { tab } = await searchParams;
  const name = decodeURIComponent(rawName);

  const sbResp = await safe(callGateway<{ sandbox?: Any }>("getSandbox", { name }, token));
  const polResp = await safe(callGateway<{ revision?: Any; activeVersion?: number }>("getSandboxPolicyStatus", { name, version: 0 }, token));
  const provResp = await safe(callGateway<{ providers?: Any[] }>("listSandboxProviders", { sandboxName: name }, token));
  const svcResp = await safe(callGateway<{ services?: Any[] }>("listServices", { sandbox: name }, token));

  const sb = sbResp?.sandbox ?? null;
  const policy = sb?.spec?.policy ?? polResp?.revision?.policy ?? null;

  const data = {
    name,
    phase: sb?.status?.phase ?? "",
    image: sb?.spec?.template?.image ?? "",
    providers: (sb?.spec?.providers ?? []) as string[],
    labels: (sb?.metadata?.labels ?? {}) as Record<string, string>,
    networkPolicies: (policy?.networkPolicies ?? {}) as Record<string, Any>,
    policyObj: policy ?? null,
    policyVersion: polResp?.revision?.version ?? policy?.version ?? null,
    policyStatus: polResp?.revision?.status ?? "",
    activeVersion: polResp?.activeVersion ?? null,
    attachedProviders: (provResp?.providers ?? []).map((p: Any) => ({
      name: p?.metadata?.name ?? "", type: p?.type ?? "",
      config: (p?.config ?? {}) as Record<string, string>,
      credentials: Object.keys(p?.credentials ?? {}),
    })),
    services: (svcResp?.services ?? []).map((x: Any) => ({
      service: x?.endpoint?.serviceName ?? "", port: x?.endpoint?.targetPort ?? 0,
      url: x?.url ?? "", domain: !!x?.endpoint?.domain,
    })),
    found: !!sb,
  };

  return (
    <>
      <div className="page-head">
        <div>
          <p style={{ margin: 0 }}><Link href="/console/sandboxes" className="muted">← Sandboxes</Link></p>
          <h1 className="mono" style={{ marginTop: 6 }}>{name}</h1>
        </div>
      </div>
      {!data.found ? (
        <div className="alert error">Sandbox not found, or the gateway returned an error.</div>
      ) : (
        <SandboxDetail data={data} isAdmin={s.isAdmin} initialTab={tab} />
      )}
    </>
  );
}
