import Link from "next/link";
import { consoleSession } from "@/lib/console-session";
import { callGateway } from "@/lib/grpc";
import { IconShield, IconInfo, IconAlert } from "@/components/console/icons";

type Sandbox = { metadata?: { name?: string }; status?: { phase?: string } };

// Note: ListSandboxPolicies / GetSandboxPolicyStatus are per-sandbox (they
// require a sandbox name), so we list sandboxes and let the operator drill in.
export default async function PoliciesPage() {
  const s = await consoleSession();
  const token = s.accessToken;

  let sandboxes: Sandbox[] = [];
  let error: string | null = null;
  try {
    const resp = await callGateway<{ sandboxes?: Sandbox[] }>("listSandboxes", { limit: 200 }, token);
    sandboxes = resp.sandboxes ?? [];
  } catch (e) {
    error = String(e);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Policies</h1>
          <p>Sandbox guardrails. Policies and draft review are scoped per sandbox.</p>
        </div>
      </div>

      {error && <div className="alert error" style={{ marginBottom: 18 }}><IconAlert /><div>Gateway error: {error}</div></div>}

      <div className="alert info" style={{ marginBottom: 18 }}>
        <IconInfo />
        <div>Select a sandbox to view its active guardrail policy and review pending draft chunks
          (<span className="mono">GetSandboxPolicyStatus</span>, <span className="mono">GetDraftPolicy</span>).</div>
      </div>

      <div className="panel">
        {sandboxes.length === 0 && !error ? (
          <div className="empty">
            <div className="ic"><IconShield width={22} height={22} /></div>
            <h3>No sandboxes</h3>
            <p>Guardrail policies apply to sandboxes — create one first.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="grid">
              <thead><tr><th>Sandbox</th><th>Status</th><th style={{ textAlign: "right" }}>Policy</th></tr></thead>
              <tbody>
                {sandboxes.map((sb, i) => {
                  const nm = sb.metadata?.name ?? "";
                  return (
                    <tr key={nm || i}>
                      <td className="cell-name mono">{nm ? <Link href={`/console/sandboxes/${encodeURIComponent(nm)}?tab=policy`}>{nm}</Link> : "—"}</td>
                      <td className="muted">{(sb.status?.phase || "").replace(/^SANDBOX_PHASE_/, "").toLowerCase() || "—"}</td>
                      <td style={{ textAlign: "right" }}>{nm && <Link href={`/console/sandboxes/${encodeURIComponent(nm)}?tab=policy`} className="tag rule-allow">View policy →</Link>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
