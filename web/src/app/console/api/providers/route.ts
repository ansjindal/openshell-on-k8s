import { NextResponse } from "next/server";
import { consoleSession } from "@/lib/console-session";
import { callGateway } from "@/lib/grpc";

// GET /console/api/providers → configured provider instances (for the create picker, etc.)
export async function GET() {
  const { accessToken: token } = await consoleSession();
  try {
    const resp = await callGateway<{ providers?: Array<{ metadata?: { name?: string }; type?: string }> }>(
      "listProviders", {}, token,
    );
    const providers = (resp.providers ?? []).map((p) => ({ name: p.metadata?.name ?? "", type: p.type ?? "" })).filter((p) => p.name);
    return NextResponse.json({ providers });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
