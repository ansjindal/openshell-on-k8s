"use client";

import { signIn, signOut } from "next-auth/react";

// Client-driven auth so the redirect to the IdP is a full-page navigation
// (window.location), not a Next.js soft navigation. This matters when the IdP
// shares the app's origin (e.g. Keycloak at /auth, app at /console) — a server
// action redirect() there would be treated as an internal route and 404.
export function SignInButton({ className }: { className?: string }) {
  return (
    <button className={className} onClick={() => signIn("openshell", { callbackUrl: "/console" })}>
      Sign in
    </button>
  );
}

export function SignOutButton({ className }: { className?: string }) {
  return (
    <button className={className} onClick={() => signOut({ callbackUrl: "/console" })}>
      Sign out
    </button>
  );
}
