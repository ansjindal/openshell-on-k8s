import { NextResponse } from "next/server";
import { consoleSession } from "@/lib/console-session";
import { callGateway } from "@/lib/grpc";

// DELETE /console/api/sandboxes/:name  → delete
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { accessToken: token } = await consoleSession();
  const { name } = await params;
  try {
    const resp = await callGateway("deleteSandbox", { name }, token);
    return NextResponse.json(resp);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
