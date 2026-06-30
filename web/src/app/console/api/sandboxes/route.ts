import { NextResponse } from "next/server";
import { consoleSession } from "@/lib/console-session";
import { callGateway } from "@/lib/grpc";

// Default sandbox image (the public OpenClaw community sandbox). Override via env.
const DEFAULT_IMAGE = process.env.OPENSHELL_DEFAULT_IMAGE ||
  "ghcr.io/nvidia/openshell-community/sandboxes/openclaw:latest";

// GET /console/api/sandboxes  → list
export async function GET() {
  const { accessToken: token } = await consoleSession();
  try {
    const resp = await callGateway<{ sandboxes?: unknown[] }>("listSandboxes", { limit: 200 }, token);
    return NextResponse.json({ sandboxes: resp.sandboxes ?? [] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}

// POST /console/api/sandboxes  { name, image?, providers?: string[] }  → create
export async function POST(req: Request) {
  const { accessToken: token } = await consoleSession();

  const body = await req.json().catch(() => ({}));
  const providers: string[] = Array.isArray(body.providers)
    ? body.providers.filter((p: unknown) => typeof p === "string" && p)
    : [];

  // A real SandboxSpec: the gateway needs a template image to provision the pod.
  const spec: Record<string, unknown> = {
    template: { image: body.image || DEFAULT_IMAGE },
    ...(providers.length ? { providers } : {}),
  };

  try {
    const resp = await callGateway("createSandbox", { name: body.name || "", spec, labels: body.labels || {} }, token);
    return NextResponse.json(resp);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
