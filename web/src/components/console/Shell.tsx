"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconFleet, IconBox, IconProvider, IconInference, IconShield, IconLogo } from "@/components/console/icons";
import { SignOutButton } from "@/components/console/AuthButtons";

type ShellUser = { name: string; isAdmin: boolean };

// Routes are mounted under /console (no Next.js basePath), so nav hrefs and the
// active-state matching use the /console prefix explicitly.
const NAV = [
  { href: "/console", label: "Fleet", icon: IconFleet },
  { href: "/console/sandboxes", label: "Sandboxes", icon: IconBox },
  { href: "/console/providers", label: "Providers", icon: IconProvider },
  { href: "/console/inference", label: "Inference", icon: IconInference },
  { href: "/console/policies", label: "Policies", icon: IconShield },
];

const TITLES: Record<string, string> = {
  "/console": "Fleet", "/console/sandboxes": "Sandboxes", "/console/providers": "Providers",
  "/console/inference": "Inference", "/console/policies": "Policies",
};

export function Shell({ children, oidcEnabled = false, user = null, pendingDrafts = 0, openclawUiUrl = null }: { children: ReactNode; oidcEnabled?: boolean; user?: ShellUser | null; pendingDrafts?: number; openclawUiUrl?: string | null }) {
  const pathname = usePathname() || "/console";
  const active = (href: string) => (href === "/console" ? pathname === "/console" : pathname.startsWith(href));
  const title = TITLES[pathname] ?? Object.entries(TITLES).find(([h]) => h !== "/console" && pathname.startsWith(h))?.[1] ?? "Console";

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="logo"><IconLogo width={16} height={16} /></span>
          <span className="text">OpenShell<span className="sub">Console</span></span>
        </div>
        {openclawUiUrl && (
          <a href={openclawUiUrl} target="_blank" rel="noreferrer" className="nav-item">
            <span className="label">OpenClaw UI ↗</span>
          </a>
        )}
        <nav className="nav">
          <div className="nav-label">Manage</div>
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={`nav-item ${active(href) ? "active" : ""}`}>
              <Icon /><span className="label">{label}</span>
              {href === "/console/sandboxes" && pendingDrafts > 0 && (
                <span className="badge admin" style={{ marginLeft: "auto" }} title={`${pendingDrafts} pending draft policy change${pendingDrafts === 1 ? "" : "s"}`}>
                  {pendingDrafts}
                </span>
              )}
            </Link>
          ))}
        </nav>
        <div className="side-foot">
          {openclawUiUrl && (
            <a href={openclawUiUrl} target="_blank" rel="noreferrer" className="nav-item">
              <span className="label">OpenClaw UI ↗</span>
            </a>
          )}
          <Link href="/" className="nav-item">
            <span className="label">← Back to lessons</span>
          </Link>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="crumb">OpenShell&nbsp;/&nbsp;<b>{title}</b></div>
          {oidcEnabled ? (
            <div className="auth-status">
              <span className="user">{user?.name}</span>
              {user?.isAdmin && <span className="badge admin">Admin</span>}
              <SignOutButton className="btn ghost signout" />
            </div>
          ) : (
            <span className="badge admin">Open mode</span>
          )}
        </header>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
