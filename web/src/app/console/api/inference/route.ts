import { NextResponse } from "next/server";
import { consoleSession } from "@/lib/console-session";
import { callInference } from "@/lib/grpc";

// GET /console/api/inference → current inference.local route
export async function GET() {
  const { accessToken: token } = await consoleSession();
  try {
    const resp = await callInference("getClusterInference", { routeName: "" }, token);
    return NextResponse.json(resp);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}

// POST /console/api/inference { providerName, modelId, timeoutSecs? } → set route
export async function POST(req: Request) {
  const { accessToken: token } = await consoleSession();
  const body = await req.json().catch(() => ({}));
  if (!body.providerName || !body.modelId) {
    return NextResponse.json({ error: "providerName and modelId are required" }, { status: 400 });
  }
  try {
    const resp = await callInference("setClusterInference", {
      providerName: body.providerName,
      modelId: body.modelId,
      routeName: "",
      ...(body.timeoutSecs ? { timeoutSecs: Number(body.timeoutSecs) } : {}),
    }, token);
    return NextResponse.json(resp);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
