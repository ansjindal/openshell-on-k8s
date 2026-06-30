import NextAuth, { customFetch } from "next-auth";

// Real OIDC for the embedded console (the /console route subtree only). The rest
// of the teaching site stays public — nothing outside /console imports this.
//
// Provider-agnostic OIDC (Keycloak is the documented default). Everything is
// env-driven so any OIDC issuer works:
//   OIDC_ISSUER         e.g. https://host/auth/realms/openshell  (REQUIRED to enable login)
//   OIDC_CLIENT_ID      e.g. openshell-ui                        (default "openshell-ui")
//   OIDC_CLIENT_SECRET
//   OIDC_ROLES_CLAIM    roles/groups claim name                  (default "groups")
//   OIDC_ADMIN_ROLE     role that grants admin                   (default "openshell-admin")
//   AUTH_SECRET         random string for session encryption
//   AUTH_URL            public base URL of the app
const ROLES_CLAIM = process.env.OIDC_ROLES_CLAIM || "groups"; // also try realm_access.roles
const ADMIN_ROLE = process.env.OIDC_ADMIN_ROLE || "openshell-admin";

function extractRoles(profile: Record<string, unknown> | undefined): string[] {
  if (!profile) return [];
  const direct = profile[ROLES_CLAIM];
  if (Array.isArray(direct)) return direct as string[];
  const realm = profile["realm_access"] as { roles?: string[] } | undefined;
  return realm?.roles ?? [];
}

// The launchpad proxy (Pomerium) 302-redirects SERVER-SIDE fetches to the public host, so
// OIDC discovery / token / jwks over OIDC_ISSUER fail ("response is not a conform … Metadata
// response") and the console dies with error=Configuration before any login form. When
// OIDC_INTERNAL_ISSUER is set (a URL the server reaches WITHOUT Pomerium — the box-local Envoy,
// which routes /auth → Keycloak), this customFetch rewrites every back-channel request from the
// public origin to the internal one. The browser's authorize redirect is NOT a server fetch, so
// it stays on the public host; and the discovered `issuer` is still the public value (Keycloak's
// KC_HOSTNAME), so the id_token `iss` validates.
const PUBLIC_ORIGIN = process.env.OIDC_ISSUER ? new URL(process.env.OIDC_ISSUER).origin : "";
const INTERNAL_ORIGIN = process.env.OIDC_INTERNAL_ISSUER ? new URL(process.env.OIDC_INTERNAL_ISSUER).origin : "";
const internalBackchannelFetch: typeof fetch = (input, init) => {
  const orig = input instanceof Request ? input.url : input.toString();
  if (PUBLIC_ORIGIN && INTERNAL_ORIGIN && orig.startsWith(PUBLIC_ORIGIN)) {
    const rewritten = INTERNAL_ORIGIN + orig.slice(PUBLIC_ORIGIN.length);
    return input instanceof Request ? fetch(new Request(rewritten, input)) : fetch(rewritten, init);
  }
  return fetch(input, init);
};

// The console is a route SEGMENT of this app (no Next.js basePath), so Auth.js
// lives at the literal path /console/api/auth. Telling Auth.js its basePath here
// keeps sign-in / callback / redirect_uri all under /console/api/auth.
export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  basePath: "/console/api/auth",
  providers: [
    {
      id: "openshell",
      name: "OpenShell SSO",
      type: "oidc",
      issuer: process.env.OIDC_ISSUER,
      clientId: process.env.OIDC_CLIENT_ID || "openshell-ui",
      clientSecret: process.env.OIDC_CLIENT_SECRET,
      // Request only standard scopes (the roles/groups claim comes from a mapper).
      authorization: { params: { scope: "openid profile email" } },
      // Route the server-side back-channel (discovery/token/jwks) around Pomerium — see the
      // internalBackchannelFetch comment above. Only when OIDC_INTERNAL_ISSUER is configured.
      ...(INTERNAL_ORIGIN ? { [customFetch]: internalBackchannelFetch } : {}),
    },
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      // Keep the upstream access token to forward to the gateway, + roles.
      if (account?.access_token) token.accessToken = account.access_token;
      if (profile) token.roles = extractRoles(profile);
      return token;
    },
    async session({ session, token }) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (session as any).accessToken = token.accessToken;
      const roles = (token.roles as string[]) ?? [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (session as any).roles = roles;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (session as any).isAdmin = roles.includes(ADMIN_ROLE);
      return session;
    },
  },
});
