import "./globals.css";
import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import { SiteHeader } from "@/components/SiteHeader";

// Fonts come from npm (@fontsource), bundled at build time: no Google Fonts
// request at build or page-load time, and no late font swap between pages.
export const metadata: Metadata = {
  title: "OpenShell on Kubernetes",
  description: "A hands-on teaching site for running sandboxed AI agents (pi) on Kubernetes — with deny-by-default policies, credentials the agent never sees, an audit trail, and a live shell right in the page.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: `try{document.documentElement.dataset.theme=localStorage.getItem('oclaw-theme')||'dark';}catch(e){}` }} />
      </head>
      <body>
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
