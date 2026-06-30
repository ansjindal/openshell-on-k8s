import { auth } from "@/lib/auth";

// Session helper for the embedded OpenShell console. Every console page and BFF
// route calls consoleSession(); this single helper decides between two modes so
// callers never have to:
//
//   REAL OIDC  (OIDC_ISSUER set)  → next-auth (Keycloak/OIDC) session, mapped to
//                                   { accessToken, roles, isAdmin }. The console
//                                   layout redirects to sign-in when there's no
//                                   session, so reaching a page here means
//                                   authenticated.
//   OPEN MODE  (OIDC_ISSUER unset) → no login at all: admin, no token. Keeps
//                                    local/dev and key-less installs working.
//
// Only the /console subtree imports this — the lessons/home/links stay public.
export type ConsoleSession = {
  accessToken: string | undefined;
  roles: string[];
  isAdmin: boolean;
};

const ADMIN_ROLE = process.env.OIDC_ADMIN_ROLE || "openshell-admin";

/** True when real OIDC login is configured for the console. */
export function oidcEnabled(): boolean {
  return Boolean(process.env.OIDC_ISSUER);
}

export async function consoleSession(): Promise<ConsoleSession> {
  if (!oidcEnabled()) {
    // OPEN MODE: full admin UI, no Bearer token forwarded to the gateway.
    return { accessToken: undefined, roles: [ADMIN_ROLE], isAdmin: true };
  }

  const session = await auth();
  if (!session) {
    // No session under OIDC: the console layout redirects to sign-in before
    // rendering, so this is the BFF-route case (return an unauthenticated shape).
    return { accessToken: undefined, roles: [], isAdmin: false };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = session as any;
  const roles = (s.roles as string[]) ?? [];
  return {
    accessToken: s.accessToken as string | undefined,
    roles,
    isAdmin: typeof s.isAdmin === "boolean" ? s.isAdmin : roles.includes(ADMIN_ROLE),
  };
}

/** Raw next-auth session (null in open mode or when signed out). */
export async function rawConsoleSession() {
  if (!oidcEnabled()) return null;
  return auth();
}
