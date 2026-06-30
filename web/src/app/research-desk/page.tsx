"use client";
// The Incident Desk UI, folded into the teaching site as a route. It's the research-desk SPA
// (one big client component) talking to the in-cluster backend at /research-desk/api over REST +
// SSE. Loaded client-only (ssr:false) — it was written as a browser SPA (localStorage theme,
// EventSource, etc.), so we skip SSR rather than guard every browser API.
import dynamic from "next/dynamic";
import "./research-desk.css";

const IncidentDesk = dynamic(() => import("@/components/ResearchDeskApp"), {
  ssr: false,
  loading: () => <div style={{ padding: 32, fontFamily: "var(--font-mono, monospace)" }}>Loading Incident Desk…</div>,
});

export default function ResearchDeskPage() {
  return <IncidentDesk />;
}
