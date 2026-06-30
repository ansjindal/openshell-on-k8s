"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

// Scopes next-auth/react to the console subtree only. Tells the client where the
// auth endpoints live (/console/api/auth) so client-side signIn/signOut hit the
// right URLs and perform a full-page navigation to the IdP. This wraps ONLY the
// /console layout — the rest of the site never mounts a SessionProvider.
export function ConsoleProviders({ children }: { children: ReactNode }) {
  return <SessionProvider basePath="/console/api/auth">{children}</SessionProvider>;
}
