import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { consoleSession } from "@/lib/console-session";
import { callGateway, openInteractive } from "@/lib/grpc";

export const dynamic = "force-dynamic";

// Interactive PTY shell into a sandbox (ExecSandboxInteractive). We avoid
// WebSockets (keeps the standalone build unchanged): output streams over SSE
// (GET), input/resize come back via POST, correlated by a session id held in
// process memory. The gRPC stream's lifetime is bound to the SSE connection —
// closing the tab aborts the request, which cancels the stream. So nothing runs
// in the background; load scales with open terminals, not with sandboxes.

type Session = { stream: { write: (m: unknown) => void }; close: () => void; createdAt: number };
const sessions = new Map<string, Session>();

// GET = SSE output stream. Opens the shell and streams stdout/stderr.
export async function GET(req: Request, { params }: { params: Promise<{ name: string }> }) {
  const s = await consoleSession();
  const token = s.accessToken;
  if (!s.isAdmin) return NextResponse.json({ error: "admin role required" }, { status: 403 });
  const { name } = await params;

  const u = new URL(req.url);
  const cols = Math.min(Number(u.searchParams.get("cols") || "80"), 500) || 80;
  const rows = Math.min(Number(u.searchParams.get("rows") || "24"), 200) || 24;

  // Resolve sandbox id (ExecSandbox* require the id, not the name).
  let id: string | undefined;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = await callGateway<{ sandbox?: any }>("getSandbox", { name }, token);
    id = sb?.sandbox?.metadata?.id;
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
  if (!id) return NextResponse.json({ error: "sandbox not found" }, { status: 404 });

  const sessionId = randomUUID();
  const { stream, close } = openInteractive(token);
  sessions.set(sessionId, { stream, close, createdAt: Date.now() });

  const enc = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const send = (str: string) => { if (!closed) try { controller.enqueue(enc.encode(str)); } catch { /* noop */ } };
      const cleanup = () => {
        if (closed) return; closed = true;
        close(); sessions.delete(sessionId);
        try { controller.close(); } catch { /* noop */ }
      };
      send(`event: session\ndata: ${sessionId}\n\n`);
      // Open the shell with a PTY.
      try {
        stream.write({ start: { sandboxId: id, command: ["/bin/bash"], tty: true, cols, rows } });
      } catch { /* noop */ }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (stream as any).on("data", (ev: any) => {
        const buf = ev?.stdout?.data ?? ev?.stderr?.data;
        if (buf) send(`data: ${Buffer.from(buf).toString("base64")}\n\n`);
        if (ev?.exit) { send(`event: exit\ndata: ${ev.exit.exitCode ?? 0}\n\n`); cleanup(); }
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (stream as any).on("error", (e: any) => { send(`event: srverror\ndata: ${String(e?.message || e)}\n\n`); cleanup(); });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (stream as any).on("end", () => { send(`event: end\ndata: bye\n\n`); cleanup(); });
      // Client navigated away / closed the tab → tear down the shell.
      req.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(body, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}

// POST = input: { sessionId, type: "stdin"|"resize"|"close", data?, cols?, rows? }
export async function POST(req: Request) {
  const s = await consoleSession();
  if (!s.isAdmin) return NextResponse.json({ error: "admin role required" }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const sess = sessions.get(b.sessionId);
  if (!sess) return NextResponse.json({ error: "no such session" }, { status: 404 });
  try {
    if (b.type === "stdin") sess.stream.write({ stdin: Buffer.from(String(b.data || ""), "base64") });
    else if (b.type === "resize") sess.stream.write({ resize: { cols: Number(b.cols) || 80, rows: Number(b.rows) || 24 } });
    else if (b.type === "close") { sess.close(); sessions.delete(b.sessionId); }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
