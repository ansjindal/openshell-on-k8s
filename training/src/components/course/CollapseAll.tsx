"use client";
import { useState } from "react";
import { collapseAllSections } from "./Structure";

export function CollapseAll() {
  const [open, setOpen] = useState(true);
  return (
    <button
      onClick={() => { collapseAllSections(!open); setOpen(!open); }}
      className="rounded-full border border-[var(--color-line-2)] px-3 py-1 text-xs text-[var(--color-fg-mut)] hover:text-[var(--color-fg)]"
    >
      ◦ {open ? "collapse all sections" : "expand all sections"}
    </button>
  );
}
