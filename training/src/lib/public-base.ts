import { headers } from "next/headers";

// The public origin that fronts this deployment's single Envoy ingress (the same
// host serves /console, /auth, /grafana via path routing).
//
// Prefer the ACTUAL host the request arrived on (x-forwarded-host / host) over the
// deploy-time PUBLIC_BASE_URL. This is deliberate: PUBLIC_BASE_URL is baked once by
// setup.sh from BREV_URL_DOMAIN, which defaults to the launchpad domain — so a
// brevlab (or any non-default) deployment would otherwise render links to the wrong
// host even though the browser is on the right one. Deriving from the request makes
// same-origin, path-routed links self-correct on whatever domain actually serves them.
//
// Fall back to PUBLIC_BASE_URL only when there is no host header (build/prerender),
// and to "" when neither is available (local/dev → callers show relative paths).
//
// NOTE: this is for BROWSER-FACING links only. It does NOT fix OIDC identity
// (OIDC_ISSUER / Keycloak KC_HOSTNAME / realm redirect URIs) — those are absolute
// values baked at deploy time and must be set correctly via PUBLIC_BASE_URL /
// BREV_URL_DOMAIN. The box cannot self-detect its public domain from inside.
export async function publicBaseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) {
    const proto = h.get("x-forwarded-proto") ?? "https";
    return `${proto}://${host}`;
  }
  return process.env.PUBLIC_BASE_URL || "";
}
