import { NextResponse } from "next/server";

// Runtime-only endpoint so static pages (header, lessons) can show links whose
// URLs only exist at runtime: the systemd unit sets these env vars, `next build`
// never sees them.
export async function GET() {
  const base = process.env.PUBLIC_BASE_URL || "";
  return NextResponse.json({
    console: process.env.CONSOLE_URL || null,
    grafana: process.env.ENABLE_MONITORING !== "false" && base ? `${base}/grafana` : null,
  });
}
