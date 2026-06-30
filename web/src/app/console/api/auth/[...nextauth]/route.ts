import { NextRequest } from "next/server";
import { handlers } from "@/lib/auth";

// Auth.js routes for the console, mounted at the literal /console/api/auth path.
// This app has NO Next.js basePath (the console is a route segment, not a
// basePath), so Next does not strip /console from the request the handler sees —
// the request path already agrees with Auth.js's configured basePath
// (/console/api/auth). The shim below is defensive: if a request ever arrives
// without the /console prefix, re-add it before delegating so the action parser
// and the redirect_uri keep agreeing on /console/api/auth.
const BASE = "/console";

function withBasePath(req: NextRequest): NextRequest {
  const url = new URL(req.url);
  if (!url.pathname.startsWith(`${BASE}/`)) {
    url.pathname = `${BASE}${url.pathname}`;
    return new NextRequest(url, req);
  }
  return req;
}

export const GET = (req: NextRequest) => handlers.GET(withBasePath(req));
export const POST = (req: NextRequest) => handlers.POST(withBasePath(req));
