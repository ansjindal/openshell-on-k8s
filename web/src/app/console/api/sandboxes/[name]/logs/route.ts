import { NextResponse } from "next/server";
import { consoleSession } from "@/lib/console-session";
import { callGateway } from "@/lib/grpc";

type LogLine = {
  timestampMs?: string; level?: string; target?: string; message?: string;
  source?: string; fields?: Record<string, string>;
};

// GET /console/api/sandboxes/<name>/logs?source=&lines=&level= → recent gateway buffer
export async function GET(req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { accessToken: token } = await consoleSession();
  const { name } = await params;

  const url = new URL(req.url);
  const source = url.searchParams.get("source") || "";
  const minLevel = url.searchParams.get("level") || "";
  const lines = Number(url.searchParams.get("lines") || "500");

  try {
    const resp = await callGateway<{ logs?: LogLine[]; bufferTotal?: number }>(
      "getSandboxLogs",
      {
        sandboxId: name,
        lines,
        ...(source ? { sources: [source] } : {}),
        ...(minLevel ? { minLevel } : {}),
      },
      token,
    );
    return NextResponse.json({ logs: resp.logs ?? [], bufferTotal: resp.bufferTotal ?? 0 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
