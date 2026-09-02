"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ThemeToggle } from "./ThemeToggle";
import { FIRST_SLUG } from "@/lib/curriculum";

export function SiteHeader() {
  const [openclawUiUrl, setOpenclawUiUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/openclaw-ui")
      .then((r) => r.json())
      .then((d) => setOpenclawUiUrl(d.url ?? null))
      .catch(() => {});
  }, []);

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-[var(--color-line)] bg-[var(--color-header-bg)] px-5 backdrop-blur">
      <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
        <span>🦞</span>
        <span className="hidden sm:inline">
          <span className="text-[var(--color-nv-bright)]">OpenShell</span>
          <span className="text-[var(--color-fg-mut)]"> on </span>
          <span className="text-[var(--color-fg-dim)]">Kubernetes</span>
        </span>
        <span className="sm:hidden">OpenShell on K8s</span>
      </Link>
      <nav className="ml-auto flex items-center gap-2 text-[0.72rem] text-[var(--color-fg-mut)]">
        <Link href={`/learn/${FIRST_SLUG}`} className="rounded-full border border-[var(--color-line-2)] px-2.5 py-1 transition hover:border-[var(--color-nv)] hover:text-[var(--color-fg)]">Lessons</Link>
        <Link href="/console" className="rounded-full border border-[var(--color-line-2)] px-2.5 py-1 transition hover:border-[var(--color-nv)] hover:text-[var(--color-fg)]">OpenShell Console</Link>
        {openclawUiUrl && (
          <a href={openclawUiUrl} target="_blank" rel="noreferrer" className="rounded-full border border-[var(--color-line-2)] px-2.5 py-1 transition hover:border-[var(--color-nv)] hover:text-[var(--color-fg)]">OpenClaw UI ↗</a>
        )}
        <Link href="/links" className="rounded-full border border-[var(--color-line-2)] px-2.5 py-1 transition hover:border-[var(--color-nv)] hover:text-[var(--color-fg)]">Links</Link>
        <ThemeToggle />
      </nav>
    </header>
  );
}
