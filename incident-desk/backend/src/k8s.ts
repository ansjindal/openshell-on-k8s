/** Minimal in-cluster Kubernetes API client (SA token + CA), for the real-incident remediation:
 *  read the orders-config ConfigMap / Deployment and patch the pool size + roll the app. */
import https from "node:https";
import { readFileSync } from "node:fs";

const SA = "/var/run/secrets/kubernetes.io/serviceaccount";
const HOST = process.env.KUBERNETES_SERVICE_HOST || "kubernetes.default.svc";
const PORT = process.env.KUBERNETES_SERVICE_PORT || "443";
const token = () => readFileSync(`${SA}/token`, "utf8");
const ca = () => { try { return readFileSync(`${SA}/ca.crt`); } catch { return undefined; } };

function api(method: string, path: string, body?: unknown, contentType = "application/json"): Promise<any> {
  return new Promise((resolve, reject) => {
    const data = body == null ? undefined : (typeof body === "string" ? body : JSON.stringify(body));
    const req = https.request({
      host: HOST, port: PORT, path, method, ca: ca(),
      headers: { Authorization: `Bearer ${token()}`, Accept: "application/json", ...(data ? { "Content-Type": contentType, "Content-Length": Buffer.byteLength(data) } : {}) },
    }, (res) => {
      let s = ""; res.on("data", (d) => (s += d));
      res.on("end", () => {
        if ((res.statusCode ?? 500) >= 200 && (res.statusCode ?? 500) < 300) { try { resolve(JSON.parse(s)); } catch { resolve(s); } }
        else reject(new Error(`k8s ${method} ${path}: ${res.statusCode} ${s.slice(0, 300)}`));
      });
    });
    req.on("error", reject); if (data) req.write(data); req.end();
  });
}

/** `kubectl get pods`-style summary for a namespace. */
export async function listPods(ns: string): Promise<any[]> {
  const j = await api("GET", `/api/v1/namespaces/${ns}/pods`);
  const now = Date.now();
  return (j.items ?? []).map((p: any) => {
    const cs = p.status?.containerStatuses ?? [];
    const ready = cs.filter((c: any) => c.ready).length;
    const restarts = cs.reduce((n: number, c: any) => n + (c.restartCount ?? 0), 0);
    const waiting = cs.map((c: any) => c.state?.waiting?.reason).find(Boolean);
    const term = cs.map((c: any) => c.lastState?.terminated?.reason).find(Boolean);
    const start = p.metadata?.creationTimestamp ? Date.parse(p.metadata.creationTimestamp) : now;
    const ageS = Math.max(0, Math.round((now - start) / 1000));
    const age = ageS > 3600 ? `${Math.round(ageS / 3600)}h` : ageS > 60 ? `${Math.round(ageS / 60)}m` : `${ageS}s`;
    return { name: p.metadata?.name, status: waiting || p.status?.phase, ready: `${ready}/${cs.length || 1}`, restarts, lastReason: term, age };
  });
}

export const getConfigMap = (ns: string, n: string) => api("GET", `/api/v1/namespaces/${ns}/configmaps/${n}`);
export const patchConfigMap = (ns: string, n: string, data: Record<string, string>) =>
  api("PATCH", `/api/v1/namespaces/${ns}/configmaps/${n}`, { data }, "application/merge-patch+json");
export const getDeployment = (ns: string, n: string) => api("GET", `/apis/apps/v1/namespaces/${ns}/deployments/${n}`);
export const restartDeployment = (ns: string, n: string) =>
  api("PATCH", `/apis/apps/v1/namespaces/${ns}/deployments/${n}`,
    { spec: { template: { metadata: { annotations: { "incidentdesk.openshell.io/restartedAt": new Date().toISOString() } } } } },
    "application/strategic-merge-patch+json");
