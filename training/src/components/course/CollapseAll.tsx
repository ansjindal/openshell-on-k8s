"use client";
import { useState } from "react";
import { collapseAllSections } from "./Structure";

export function CollapseAll() {
  const [open, setOpen] = useState(true);
  return (
    <span className="clearall secall" onClick={() => { collapseAllSections(!open); setOpen(!open); }}>
      {open ? "▾ collapse all sections" : "▸ expand all sections"}
    </span>
  );
}
