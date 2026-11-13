"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ThemeToggle } from "./ThemeToggle";

type Links = { console: string | null; grafana: string | null };

export function SiteHeader() {
  const [links, setLinks] = useState<Links>({ console: null, grafana: null });

  useEffect(() => {
    fetch("/api/site-links")
      .then((r) => r.json())
      .then((d) => setLinks({ console: d.console ?? null, grafana: d.grafana ?? null }))
      .catch(() => {});
  }, []);

  return (
    <header className="sitehead">
      <Link href="/" className="brand" title="Back to overview">
        <div className="nvwm"><div className="nvname">OpenShell</div><div className="nvsub">on Kubernetes</div></div>
        <div className="divx" />
        <div><div className="wm">Sandboxed AI Agents<br />Hands-on <b>Lab</b></div></div>
      </Link>
      <span className="badge live" title="This portal runs the labs on your own VM."><span className="dot" />LIVE LAB</span>
      <span className="cfg"><b>OpenShell 0.1.7 · k3s</b></span>
      <span className="spacer" />
      {links.console && <a href={links.console} target="_blank" rel="noreferrer" className="hbtn adminbtn">Console ↗</a>}
      {links.grafana && <a href={links.grafana} target="_blank" rel="noreferrer" className="hbtn adminbtn">Grafana ↗</a>}
      <Link href="/links" className="hbtn adminbtn">Links</Link>
      <ThemeToggle />
    </header>
  );
}
