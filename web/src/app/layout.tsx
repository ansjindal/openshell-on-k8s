import "./globals.css";
import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { SiteHeader } from "@/components/SiteHeader";

// Self-hosted via next/font (built into the JS bundle at build time) instead of a
// Google Fonts <link> tag — no external request at page-load time, no render with a
// fallback font before a late swap. That external-CDN swap was the source of visibly
// inconsistent fonts/sizes between pages (whichever font had or hadn't finished
// loading yet when each page painted).
const inter = Inter({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700", "800"], variable: "--font-sans-loaded", display: "swap" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono-loaded", display: "swap" });

export const metadata: Metadata = {
  title: "OpenShell on Kubernetes",
  description: "A hands-on teaching site for running sandboxed AI agents (OpenClaw 🦞) on Kubernetes — with gVisor kernel isolation, credential-isolated inference, and a live shell right in the page.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
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
