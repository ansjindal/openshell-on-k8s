import { NextResponse } from "next/server";

// Tiny runtime-only endpoint so the (statically-optimized) root layout/SiteHeader
// can pick up OPENCLAW_UI_URL without forcing every lesson page to render
// dynamically — the systemd unit only sets this env var at runtime, not at
// `next build` time, so a plain process.env read in a static server component
// would bake in an empty value.
export async function GET() {
  return NextResponse.json({ url: process.env.OPENCLAW_UI_URL || null });
}
