import { IconLogo } from "@/components/console/icons";
import { SignInButton } from "@/components/console/AuthButtons";

// Full-page sign-in gate shown for the /console subtree when OIDC is enabled and
// there is no session. Clicking Sign in does a full-page navigation to the IdP
// via /console/api/auth (see AuthButtons / next-auth basePath).
export function SignInScreen() {
  return (
    <div className="signin-screen">
      <div className="signin-card">
        <span className="logo"><IconLogo width={28} height={28} /></span>
        <h1>OpenShell Console</h1>
        <p>Sign in to manage your agent-sandbox fleet.</p>
        <SignInButton className="btn primary" />
        <a className="signin-back" href="/">← Back to lessons</a>
      </div>
    </div>
  );
}
