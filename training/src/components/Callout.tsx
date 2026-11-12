import type { ReactNode } from "react";

// The course template's callout: a coloured left edge, a title, the body.
const KIND: Record<string, { cls: string; label: string }> = {
  note: { cls: "note", label: "Note" }, rh: { cls: "note", label: "Note" },
  tip: { cls: "tip", label: "Tip" }, nv: { cls: "tip", label: "Why it matters" },
  warn: { cls: "warn", label: "Heads up" }, lab: { cls: "lab", label: "In the lab" },
};
export function Callout({ type = "note", title, children }: { type?: string; title?: string; children: ReactNode }) {
  const k = KIND[type] ?? KIND.note;
  return (
    <div className={`callout ${k.cls}`}>
      <div className="coh">{title ?? k.label}</div>
      <div className="cob">{children}</div>
    </div>
  );
}
