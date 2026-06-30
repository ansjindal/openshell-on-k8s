import Link from "next/link";
import { consoleSession } from "@/lib/console-session";
import { callGateway } from "@/lib/grpc";
import SandboxActions from "./Actions";
import { IconBox, IconAlert } from "@/components/console/icons";

type Sandbox = {
  metadata?: { name?: string; labels?: Record<string, string> };
  status?: { phase?: string };
};

// SANDBOX_PHASE_READY -> { text: "Ready", tone: "ready" }
function phasePill(phase?: string): { text: string; tone: string } {
  const raw = (phase || "").replace(/^SANDBOX_PHASE_/, "").replace(/_/g, " ").trim();
  const text = raw ? raw.charAt(0) + raw.slice(1).toLowerCase() : "Unknown";
  const p = raw.toUpperCase();
  if (p.includes("READY") || p.includes("RUNNING")) return { text, tone: "ready" };
  if (p.includes("FAIL") || p.includes("ERROR")) return { text, tone: "error" };
  if (p.includes("TERMINAT") || p.includes("DELET")) return { text, tone: "error" };
  if (p.includes("PEND") || p.includes("PROVISION") || p.includes("CREAT") || p.includes("INIT")) return { text, tone: "pending" };
  return { text: text || "Unknown", tone: "unknown" };
}

export default async function SandboxesPage() {
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
          <h1>Sandboxes</h1>
          <p>{sandboxes.length} sandbox{sandboxes.length === 1 ? "" : "es"} in the fleet{s.isAdmin ? "" : " · read-only"}.</p>
        </div>
        {s.isAdmin && <SandboxActions />}
      </div>

      {error && (
        <div className="alert error" style={{ marginBottom: 18 }}>
          <IconAlert /><div>Gateway error: {error}</div>
        </div>
      )}

      <div className="panel">
        {sandboxes.length === 0 && !error ? (
          <div className="empty">
            <div className="ic"><IconBox width={22} height={22} /></div>
            <h3>No sandboxes yet</h3>
            <p>{s.isAdmin ? "Create one with the button above to get started." : "Nothing to show — an admin can create sandboxes."}</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="grid">
              <thead>
                <tr>
                  <th>Name</th><th>Status</th><th>Labels</th>{s.isAdmin && <th style={{ textAlign: "right" }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {sandboxes.map((sb) => {
                  const name = sb.metadata?.name ?? "—";
                  const { text, tone } = phasePill(sb.status?.phase);
                  const labels = Object.entries(sb.metadata?.labels ?? {});
                  return (
                    <tr key={name}>
                      <td className="cell-name mono"><Link href={`/console/sandboxes/${encodeURIComponent(name)}`}>{name}</Link></td>
                      <td><span className={`pill ${tone}`}><span className="dot" />{text}</span></td>
                      <td>
                        {labels.length === 0 ? <span className="muted">—</span> :
                          labels.slice(0, 3).map(([k, v]) => <span key={k} className="tag" style={{ marginRight: 6 }}>{k}={v}</span>)}
                        {labels.length > 3 && <span className="muted">+{labels.length - 3}</span>}
                      </td>
                      {s.isAdmin && <td style={{ textAlign: "right" }}><SandboxActions deleteName={name} /></td>}
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
