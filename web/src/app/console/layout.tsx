import type { ReactNode } from "react";
import { Shell } from "@/components/console/Shell";
import { ConsoleProviders } from "./providers";
import { SignInScreen } from "@/components/console/SignInScreen";
import { oidcEnabled, rawConsoleSession } from "@/lib/console-session";
import "./console.css";

// Nested layout for the embedded OpenShell console. The root layout already
// renders <html>/<body>, so this only scopes the console's styles under
// .console-root and folds in the sidebar Shell.
//
// AUTH GATE (the /console subtree ONLY): when OIDC is configured (OIDC_ISSUER
// set) and there is no session, render a sign-in screen that bounces to
// /console/api/auth/signin. When OIDC is unset, the console runs in OPEN mode
// (no login). Nothing outside /console is touched — lessons/home/links are public.
export const metadata = { title: "OpenShell Console" };
// Evaluate at request time so OIDC_ISSUER (set on the running service, not at
// build time) actually decides open-mode vs gated — otherwise the build bakes
// open-mode and the runtime gate never activates.
export const dynamic = "force-dynamic";

export default async function ConsoleLayout({ children }: { children: ReactNode }) {
  const enabled = oidcEnabled();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const session = (await rawConsoleSession()) as any | null;

  if (enabled && !session) {
    return (
      <div className="console-root">
        <ConsoleProviders>
          <SignInScreen />
        </ConsoleProviders>
      </div>
    );
  }

  const user = enabled
    ? { name: session?.user?.name || session?.user?.email || "Signed in", isAdmin: Boolean(session?.isAdmin) }
    : null;

  return (
    <div className="console-root">
      <ConsoleProviders>
        <Shell oidcEnabled={enabled} user={user}>{children}</Shell>
      </ConsoleProviders>
    </div>
  );
}
