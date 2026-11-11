import { Info, Lightbulb, AlertTriangle, FlaskConical } from "lucide-react";
import type { ReactNode } from "react";

const KINDS = {
  note: { icon: Info, color: "#76b900", label: "Note" },
  tip: { icon: Lightbulb, color: "#a3e635", label: "Tip" },
  warn: { icon: AlertTriangle, color: "#e0a800", label: "Heads up" },
  rh: { icon: Info, color: "#76b900", label: "Note" },
  lab: { icon: FlaskConical, color: "#76b900", label: "In the lab" },
} as const;

export function Callout({ type = "note", title, children }: { type?: keyof typeof KINDS; title?: string; children: ReactNode }) {
  const k = KINDS[type] ?? KINDS.note;
  const Icon = k.icon;
  return (
    <div className="not-prose my-5 flex gap-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-ink2)] px-4 py-3 text-[14px] leading-[23.8px]" style={{ borderLeft: `3px solid ${k.color}` }}>
      <Icon size={18} style={{ color: k.color, flexShrink: 0, marginTop: 2 }} />
      <div className="min-w-0">
        <div className="mb-1 text-sm font-semibold" style={{ color: k.color }}>{title ?? k.label}</div>
        <div className="text-[14px] leading-[23.8px] text-[var(--color-fg-dim)] [&>*+*]:mt-2 [&_code]:font-mono [&_code]:text-[12px] [&_code]:text-[var(--color-nv-bright)] [&_strong]:text-[var(--color-fg)]">{children}</div>
      </div>
    </div>
  );
}
