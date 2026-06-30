import { NextResponse } from "next/server";
import { consoleSession } from "@/lib/console-session";
import { callGateway } from "@/lib/grpc";

// GET /console/api/sandboxes/<name>/drafts → pending draft-policy chunks
export async function GET(req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { accessToken: token } = await consoleSession();
  const { name } = await params;
  const status = new URL(req.url).searchParams.get("status") || "";
  try {
    const resp = await callGateway<Record<string, unknown>>("getDraftPolicy", { name, statusFilter: status }, token);
    // History is best-effort — fold it in without failing the whole request.
    let history: unknown[] = [];
    try {
      const h = await callGateway<{ entries?: unknown[] }>("getDraftHistory", { name }, token);
      history = h.entries ?? [];
    } catch { /* ignore */ }
    return NextResponse.json({ ...resp, history });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}

// POST /console/api/sandboxes/<name>/drafts  { action, chunkId?, reason?, includeSecurityFlagged? }
//   action: approve | reject | approve-all | undo | clear
export async function POST(req: Request, { params }: { params: Promise<{ name: string }> }) {
  const s = await consoleSession();
  const token = s.accessToken;
  if (!s.isAdmin) return NextResponse.json({ error: "admin role required" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { name } = await params;
  try {
    let resp: unknown;
    switch (body.action) {
      case "approve":
        resp = await callGateway("approveDraftChunk", { name, chunkId: body.chunkId }, token); break;
      case "reject":
        resp = await callGateway("rejectDraftChunk", { name, chunkId: body.chunkId, reason: body.reason || "" }, token); break;
      case "approve-all":
        resp = await callGateway("approveAllDraftChunks", { name, includeSecurityFlagged: !!body.includeSecurityFlagged }, token); break;
      case "undo":
        resp = await callGateway("undoDraftChunk", { name, chunkId: body.chunkId }, token); break;
      case "clear":
        resp = await callGateway("clearDraftChunks", { name }, token); break;
      default:
        return NextResponse.json({ error: "unknown action" }, { status: 400 });
    }
    return NextResponse.json(resp ?? {});
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
