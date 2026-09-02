import { NextResponse } from "next/server";
import { consoleSession } from "@/lib/console-session";
import { callGateway, execSandboxCollect } from "@/lib/grpc";

// Device-pairing approvals for OpenClaw's own Control UI (a DIFFERENT approval queue
// than the egress draft-policy one in ../drafts/route.ts — that's the agent asking for
// network access; this is a browser/CLI asking to pair with OpenClaw's chat UI). Read
// via `openclaw devices list --json` and act via `openclaw devices approve|reject`,
// run inside the sandbox over the same ExecSandbox RPC the egress-log route already
// uses — no separate CLI/credential path needed.
//
// Requires ENABLE_OPENCLAW_UI=true (the process this reads only runs then) and reads
// OPENCLAW_UI_PORT/OPENCLAW_GATEWAY_PASSWORD from this process's own env, threaded in
// by scripts/setup.sh's workshop systemd unit.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

function shQuote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

function wsUrl(): string {
  const port = process.env.OPENCLAW_UI_PORT || "30789";
  return `ws://127.0.0.1:${port}`;
}

function gwPassword(): string {
  return process.env.OPENCLAW_GATEWAY_PASSWORD || "openshell-wad26";
}

function parseJsonTail(text: string): Any {
  const a = text.indexOf("{"), b = text.lastIndexOf("}");
  if (a < 0 || b < a) return null;
  try { return JSON.parse(text.slice(a, b + 1)); } catch { return null; }
}

async function resolveSandboxId(name: string, token?: string): Promise<string | null> {
  const sb = await callGateway<{ sandbox?: Any }>("getSandbox", { name }, token);
  return sb?.sandbox?.metadata?.id ?? null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const s = await consoleSession();
  if (!s.isAdmin) return NextResponse.json({ error: "admin role required" }, { status: 403 });
  if (process.env.ENABLE_OPENCLAW_UI !== "true") return NextResponse.json({ pending: [], enabled: false });

  const { name } = await params;
  try {
    const id = await resolveSandboxId(name, s.accessToken);
    if (!id) return NextResponse.json({ error: "sandbox not found" }, { status: 404 });
    const cmd = ["sh", "-lc", `openclaw devices list --url ${wsUrl()} --password ${shQuote(gwPassword())} --json`];
    const { stdout, code } = await execSandboxCollect(id, cmd, s.accessToken, 15);
    const parsed = parseJsonTail(stdout);
    if (!parsed) return NextResponse.json({ pending: [], enabled: true, note: code === 0 ? "no output" : `exit ${code}` });
    return NextResponse.json({ pending: parsed.pending ?? [], paired: (parsed.paired ?? []).length, enabled: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}

// POST { action: "approve" | "reject" | "approve-all", requestId? }
export async function POST(req: Request, { params }: { params: Promise<{ name: string }> }) {
  const s = await consoleSession();
  if (!s.isAdmin) return NextResponse.json({ error: "admin role required" }, { status: 403 });
  if (process.env.ENABLE_OPENCLAW_UI !== "true") return NextResponse.json({ error: "OpenClaw UI not enabled" }, { status: 400 });

  const { name } = await params;
  const body = await req.json().catch(() => ({}));
  try {
    const id = await resolveSandboxId(name, s.accessToken);
    if (!id) return NextResponse.json({ error: "sandbox not found" }, { status: 404 });

    const approveOne = async (requestId: string) => {
      const cmd = ["sh", "-lc", `openclaw devices approve ${shQuote(requestId)} --url ${wsUrl()} --password ${shQuote(gwPassword())} --timeout 8000`];
      return execSandboxCollect(id, cmd, s.accessToken, 15);
    };

    if (body.action === "approve-all") {
      const listCmd = ["sh", "-lc", `openclaw devices list --url ${wsUrl()} --password ${shQuote(gwPassword())} --json`];
      const { stdout } = await execSandboxCollect(id, listCmd, s.accessToken, 15);
      const parsed = parseJsonTail(stdout);
      const ids: string[] = (parsed?.pending ?? []).map((d: Any) => d.requestId).filter(Boolean);
      for (const rid of ids) await approveOne(rid);
      return NextResponse.json({ ok: true, approved: ids.length });
    }

    if (body.action === "approve" || body.action === "reject") {
      if (typeof body.requestId !== "string" || !body.requestId) {
        return NextResponse.json({ error: "requestId required" }, { status: 400 });
      }
      const verb = body.action;
      const cmd = ["sh", "-lc", `openclaw devices ${verb} ${shQuote(body.requestId)} --url ${wsUrl()} --password ${shQuote(gwPassword())} --timeout 8000`];
      const { stdout, stderr, code } = await execSandboxCollect(id, cmd, s.accessToken, 15);
      return NextResponse.json({ ok: code === 0, output: (stdout + stderr).slice(-500) });
    }

    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
