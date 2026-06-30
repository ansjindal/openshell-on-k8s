import path from "node:path";
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";

// BFF gRPC clients for the OpenShell gateway. The vendored protos live in
// ./proto (copied from github.com/NVIDIA/OpenShell).
//   - openshell.v1.OpenShell      — sandboxes, providers, policies, logs
//   - openshell.inference.v1.Inference — cluster inference route
const PROTO_DIR = path.join(process.cwd(), "proto");
const opts = {
  keepCase: false, longs: String, enums: String, defaults: true, oneofs: true,
  includeDirs: [PROTO_DIR],
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const openshellProto = grpc.loadPackageDefinition(protoLoader.loadSync(path.join(PROTO_DIR, "openshell.proto"), opts)) as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const inferenceProto = grpc.loadPackageDefinition(protoLoader.loadSync(path.join(PROTO_DIR, "inference.proto"), opts)) as any;

const OpenShellService = openshellProto.openshell.v1.OpenShell;
const InferenceService = inferenceProto.openshell.inference.v1.Inference;

const ENDPOINT = process.env.OPENSHELL_GATEWAY_ENDPOINT || "127.0.0.1:30808";
const USE_TLS = process.env.OPENSHELL_GATEWAY_TLS === "true";

function creds() {
  return USE_TLS ? grpc.credentials.createSsl() : grpc.credentials.createInsecure();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function call<T>(Service: any, method: string, request: Record<string, unknown>, accessToken?: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const client = new Service(ENDPOINT, creds());
    const md = new grpc.Metadata();
    if (accessToken) md.set("authorization", `Bearer ${accessToken}`);
    const deadline = new Date(Date.now() + 20_000);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client as any)[method](request, md, { deadline }, (err: grpc.ServiceError | null, resp: T) => {
      try { client.close(); } catch { /* noop */ }
      if (err) reject(err);
      else resolve(resp);
    });
  });
}

/** Call a unary openshell.v1.OpenShell method, forwarding the user's OIDC token. */
export function callGateway<T = unknown>(method: string, request: Record<string, unknown>, accessToken?: string): Promise<T> {
  return call<T>(OpenShellService, method, request, accessToken);
}

/** Call a unary openshell.inference.v1.Inference method. */
export function callInference<T = unknown>(method: string, request: Record<string, unknown>, accessToken?: string): Promise<T> {
  return call<T>(InferenceService, method, request, accessToken);
}

/**
 * Open the bidirectional ExecSandboxInteractive stream (interactive PTY shell).
 * The caller writes ExecSandboxInput messages (start / stdin / resize) and reads
 * ExecSandboxEvent messages (stdout / stderr / exit). Returns the duplex stream
 * plus a close() that cancels it and frees the client.
 */
export function openInteractive(accessToken?: string, deadlineSeconds = 3600) {
  const client = new OpenShellService(ENDPOINT, creds());
  const md = new grpc.Metadata();
  if (accessToken) md.set("authorization", `Bearer ${accessToken}`);
  const deadline = new Date(Date.now() + deadlineSeconds * 1000);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stream = (client as any).execSandboxInteractive(md, { deadline });
  const close = () => { try { stream.cancel(); } catch { /* noop */ } try { client.close(); } catch { /* noop */ } };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { stream: stream as any, close };
}

/**
 * Run a ONE-SHOT command in a sandbox via the server-streaming ExecSandbox RPC
 * and collect its full stdout/stderr. Bounded by `timeoutSeconds` — the stream
 * ends when the command exits. This is deliberately not a long-lived tail: the
 * caller invokes it on demand (and only while a viewer is watching), so it
 * scales with the number of *open* views, not the number of sandboxes.
 */
export function execSandboxCollect(
  sandboxId: string,
  command: string[],
  accessToken?: string,
  timeoutSeconds = 15,
): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve, reject) => {
    const client = new OpenShellService(ENDPOINT, creds());
    const md = new grpc.Metadata();
    if (accessToken) md.set("authorization", `Bearer ${accessToken}`);
    const deadline = new Date(Date.now() + (timeoutSeconds + 5) * 1000);
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    let code: number | null = null;
    let stream: grpc.ClientReadableStream<unknown>;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      stream = (client as any).execSandbox({ sandboxId, command, timeoutSeconds }, md, { deadline });
    } catch (e) { try { client.close(); } catch { /* noop */ } return reject(e); }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    stream.on("data", (ev: any) => {
      if (ev?.stdout?.data) out.push(Buffer.from(ev.stdout.data));
      else if (ev?.stderr?.data) err.push(Buffer.from(ev.stderr.data));
      else if (ev?.exit) code = ev.exit.exitCode ?? ev.exit.exit_code ?? null;
    });
    stream.on("end", () => { try { client.close(); } catch { /* noop */ } resolve({ stdout: Buffer.concat(out).toString("utf8"), stderr: Buffer.concat(err).toString("utf8"), code }); });
    stream.on("error", (e: grpc.ServiceError) => { try { client.close(); } catch { /* noop */ } reject(e); });
  });
}
