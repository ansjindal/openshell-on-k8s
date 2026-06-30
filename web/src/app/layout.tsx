import "./globals.css";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "OpenShell on Kubernetes",
  description: "A hands-on teaching site for running sandboxed AI agents (OpenClaw 🦞) on Kubernetes — with gVisor kernel isolation, credential-isolated inference, and a live shell right in the page.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
        <script dangerouslySetInnerHTML={{ __html: `try{document.documentElement.dataset.theme=localStorage.getItem('oclaw-theme')||'dark';}catch(e){}` }} />
      </head>
      <body>
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
