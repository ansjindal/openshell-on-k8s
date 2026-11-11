"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ThemeToggle } from "./ThemeToggle";

type Links = { console: string | null; openclawUi: string | null; grafana: string | null };

export function SiteHeader() {
  const [links, setLinks] = useState<Links>({ console: null, openclawUi: null, grafana: null });

  useEffect(() => {
    fetch("/api/site-links")
      .then((r) => r.json())
      .then((d) => setLinks({ console: d.console ?? null, openclawUi: d.openclawUi ?? null, grafana: d.grafana ?? null }))
      .catch(() => {});
  }, []);

  const pill = "rounded-full border px-2.5 py-1 font-semibold tracking-wide transition";
  const ext = `${pill} border-[var(--color-line-2)] text-[var(--color-fg-dim)] hover:border-[var(--color-nv)] hover:text-[var(--color-fg)]`;

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b border-[var(--color-line)] bg-[var(--color-header-bg)] px-5 backdrop-blur">
      <Link href="/" className="flex items-center gap-4">
        <span className="leading-none">
          <span className="block text-[0.95rem] font-extrabold tracking-tight text-[var(--color-nv-bright)]">OpenShell</span>
          <span className="block text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-[var(--color-fg-mut)]">on Kubernetes</span>
        </span>
        <span className="hidden h-8 w-px bg-[var(--color-line-2)] md:block" />
        <span className="hidden text-[0.95rem] font-bold leading-tight text-[var(--color-fg)] md:block">
          Sandboxed AI Agents<br /><span className="text-[var(--color-nv-bright)]">Hands-on Lab</span>
        </span>
      </Link>
      <span className="hidden rounded-full border border-[var(--color-nv-dim)] px-2.5 py-0.5 text-[0.65rem] font-bold tracking-wider text-[var(--color-nv-bright)] lg:inline">
        ● LIVE LAB
      </span>
      <span className="hidden text-xs text-[var(--color-fg-mut)] xl:inline">OpenShell 0.1.7 · k3s</span>

      <nav className="ml-auto flex items-center gap-2 text-[0.72rem]">
        {links.console && <a href={links.console} target="_blank" rel="noreferrer" className={ext}>Console ↗</a>}
        {links.grafana && <a href={links.grafana} target="_blank" rel="noreferrer" className={ext}>Grafana ↗</a>}
        {links.openclawUi && <a href={links.openclawUi} target="_blank" rel="noreferrer" className={ext}>OpenClaw UI ↗</a>}
        <Link href="/links" className={ext}>Links</Link>
        <ThemeToggle />
      </nav>
    </header>
  );
}
