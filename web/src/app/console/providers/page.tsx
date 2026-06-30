import { consoleSession } from "@/lib/console-session";
import { callGateway } from "@/lib/grpc";
import { IconProvider, IconAlert, IconInfo } from "@/components/console/icons";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
async function safe<T>(p: Promise<T>): Promise<T | null> { try { return await p; } catch { return null; } }

const cat = (c?: string) => (c || "").replace(/^PROVIDER_PROFILE_CATEGORY_/, "").toLowerCase().replace(/_/g, " ") || "—";

export default async function ProvidersPage() {
  const s = await consoleSession();
  const token = s.accessToken;

  let providers: Any[] = []; let error: string | null = null;
  try {
    const r = await callGateway<{ providers?: Any[] }>("listProviders", {}, token);
    providers = r.providers ?? [];
  } catch (e) { error = String(e); }

  const profResp = await safe(callGateway<{ profiles?: Any[] }>("listProviderProfiles", {}, token));
  const profiles = profResp?.profiles ?? [];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Providers</h1>
          <p>Credential-backed providers attached to the gateway, and the available profile catalog.</p>
        </div>
      </div>

      {error && <div className="alert error" style={{ marginBottom: 18 }}><IconAlert /><div>Gateway error: {error}</div></div>}

      <h2 style={{ fontSize: 14, margin: "0 0 12px", color: "var(--text-dim)" }}>Configured providers</h2>
      <div className="panel" style={{ marginBottom: 26 }}>
        {providers.length === 0 && !error ? (
          <div className="empty">
            <div className="ic"><IconProvider width={22} height={22} /></div>
            <h3>No providers configured</h3>
            <p>Attach a provider from a profile below to give sandboxes scoped credentials + egress.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="grid">
              <thead><tr><th>Name</th><th>Type</th><th>Credentials</th><th>Config</th></tr></thead>
              <tbody>
                {providers.map((p, i) => (
                  <tr key={p.metadata?.name ?? i}>
                    <td className="cell-name mono">{p.metadata?.name ?? "—"}</td>
                    <td><span className="tag">{p.type || "—"}</span></td>
                    <td>{Object.keys(p.credentials ?? {}).map((k) => <span key={k} className="tag" style={{ marginRight: 6 }}>{k}</span>) || <span className="muted">—</span>}</td>
                    <td className="muted" style={{ fontSize: 12 }}>{Object.entries(p.config ?? {}).map(([k, v]) => `${k}=${v}`).join(", ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <h2 style={{ fontSize: 14, margin: "0 0 12px", color: "var(--text-dim)" }}>Profile catalog <span className="muted" style={{ fontWeight: 400 }}>({profiles.length})</span></h2>
      <div className="alert info" style={{ marginBottom: 16 }}>
        <IconInfo /><div>Profiles (providers v2) bundle credentials, endpoints, and network policy. Attaching a provider built
          from a profile auto-contributes its egress rules to a sandbox&apos;s effective policy.</div>
      </div>
      <div className="cards">
        {profiles.map((pr) => (
          <div className="card" key={pr.id}>
            <div className="ic"><IconProvider /></div>
            <h3>{pr.displayName || pr.id}</h3>
            <p style={{ marginBottom: 10 }}>{pr.description || "—"}</p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <span className="tag">{cat(pr.category)}</span>
              {pr.inferenceCapable && <span className="tag rule-allow">inference</span>}
              {(pr.credentials ?? []).slice(0, 3).flatMap((c: Any) => (c.envVars ?? []).slice(0, 1)).map((e: string) => <span key={e} className="tag mono" style={{ fontSize: 10.5 }}>{e}</span>)}
            </div>
          </div>
        ))}
        {profiles.length === 0 && <p className="muted">No profiles available (providers v2 may be disabled on this gateway).</p>}
      </div>
    </>
  );
}
