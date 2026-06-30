// Client-side fetch helper for the embedded console. The console is mounted at
// the /console route segment of the teaching site (no Next.js basePath), so its
// BFF routes live under /console/api/... Next.js does NOT rewrite fetch() URLs,
// so we hardcode the /console prefix here.
const BASE = "/console";

export function api(path: string): string {
  return `${BASE}${path}`;
}
