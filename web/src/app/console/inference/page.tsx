import { consoleSession } from "@/lib/console-session";
import { callInference, callGateway } from "@/lib/grpc";
import { IconInfo, IconAlert } from "@/components/console/icons";
import { InferenceForm } from "./InferenceForm";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
async function safe<T>(p: Promise<T>): Promise<T | null> { try { return await p; } catch { return null; } }

export default async function InferencePage() {
  const s = await consoleSession();
  const token = s.accessToken;

  let route: Any = null; let error: string | null = null;
  try {
    route = await callInference("getClusterInference", { routeName: "" }, token);
  } catch (e) { error = String(e); }

  const provResp = await safe(callGateway<{ providers?: Array<{ metadata?: { name?: string }; type?: string }> }>("listProviders", {}, token));
  const providers = (provResp?.providers ?? []).map((p) => p.metadata?.name ?? "").filter(Boolean);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Inference routing</h1>
          <p>How requests to <span className="mono">inference.local</span> are routed for every sandbox on this gateway.</p>
        </div>
      </div>

      {error && <div className="alert error" style={{ marginBottom: 18 }}><IconAlert /><div>Gateway error: {error}</div></div>}

      <div className="stats" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))" }}>
        <div className="stat"><div className="label">Provider</div><div className="value" style={{ fontSize: 20, paddingTop: 8 }}>{route?.providerName || "—"}</div><div className="trend">credential backend</div></div>
        <div className="stat"><div className="label">Model</div><div className="value mono" style={{ fontSize: 16, paddingTop: 10 }}>{route?.modelId || "—"}</div><div className="trend">served to inference.local</div></div>
        <div className="stat"><div className="label">Timeout</div><div className="value">{route?.timeoutSecs && Number(route.timeoutSecs) > 0 ? Number(route.timeoutSecs) : 60}<small> s</small></div><div className="trend">per request</div></div>
      </div>

      <div className="alert info" style={{ marginBottom: 18 }}>
        <IconInfo />
        <div>When a sandbox calls <span className="mono">https://inference.local</span>, the gateway strips caller credentials,
          injects the provider&apos;s backend credentials, and routes to the model above. Changes propagate in ~5s — no sandbox restart.</div>
      </div>

      {s.isAdmin ? (
        <InferenceForm providers={providers} current={{ providerName: route?.providerName || "", modelId: route?.modelId || "", timeoutSecs: Number(route?.timeoutSecs) || 60 }} />
      ) : (
        <p className="note">Sign in as an admin to change the route.</p>
      )}
    </>
  );
}
