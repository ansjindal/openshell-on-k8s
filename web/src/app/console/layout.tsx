import type { ReactNode } from "react";
import { Shell } from "@/components/console/Shell";
import { ConsoleProviders } from "./providers";
import { SignInScreen } from "@/components/console/SignInScreen";
import { oidcEnabled, rawConsoleSession, consoleSession } from "@/lib/console-session";
import { callGateway } from "@/lib/grpc";
import { publicBaseUrl } from "@/lib/public-base";
import "./console.css";

// OpenClaw's own Control UI lives on a separate forwarded port (not path-routed
// through Envoy — see ansible/roles/18-openclaw-forward), so this can only ever
// be a same-host-different-port link. Reuse the actual request host (not the
// deploy-time PUBLIC_BASE_URL) so it self-corrects on whatever domain is really
// serving this page, same reasoning as publicBaseUrl() itself.
async function openclawUiUrl(): Promise<string | null> {
  if (process.env.ENABLE_OPENCLAW_UI !== "true") return null;
  const port = process.env.OPENCLAW_UI_PORT || "30789";
  const base = await publicBaseUrl();
  if (!base) return null;
  try {
    const hostname = new URL(base).hostname;
    return `http://${hostname}:${port}/`;
  } catch {
    return null;
  }
}

// Fleets in this launchable are small (1-5 sandboxes), so an N+1 gRPC call
// per page load is cheap — cheaper than adding a dedicated aggregate RPC.
async function pendingDraftCount(token?: string): Promise<number> {
  try {
    const { sandboxes } = await callGateway<{ sandboxes?: { metadata?: { name?: string } }[] }>(
      "listSandboxes", { limit: 200 }, token,
    );
    const names = (sandboxes ?? []).map((s) => s.metadata?.name).filter(Boolean) as string[];
    const counts = await Promise.all(names.map(async (name) => {
      try {
        const draft = await callGateway<{ chunks?: { status?: string }[] }>("getDraftPolicy", { name, statusFilter: "" }, token);
        return (draft.chunks ?? []).filter((c) => (c.status || "pending") === "pending").length;
      } catch { return 0; }
    }));
    return counts.reduce((a, b) => a + b, 0);
  } catch {
    return 0;
  }
}

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

  const { accessToken, isAdmin } = await consoleSession();
  const pendingDrafts = isAdmin ? await pendingDraftCount(accessToken) : 0;
  const openclawUrl = await openclawUiUrl();

  return (
    <div className="console-root">
      <ConsoleProviders>
        <Shell oidcEnabled={enabled} user={user} pendingDrafts={pendingDrafts} openclawUiUrl={openclawUrl}>{children}</Shell>
      </ConsoleProviders>
    </div>
  );
}
