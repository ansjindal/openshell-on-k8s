// A numbered vertical timeline for a sequence of steps that are read, not run:
//   <Timeline>
//     <TStep n="1" title="The Sandbox controller">One line, then a code block.</TStep>
//   </Timeline>
import type { ReactNode } from "react";

export function Timeline({ children }: { children: ReactNode }) {
  return <div className="my-6">{children}</div>;
}

export function TStep({ n, title, children }: { n: string | number; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="relative pb-7 pl-12 last:pb-0 [&:last-child>.tl-line]:hidden">
      <div className="tl-line absolute bottom-0 left-[15px] top-9 w-px bg-[var(--color-line-2)]" />
      <div className="absolute left-0 top-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-[var(--color-nv)] bg-[var(--color-panel)] font-mono text-[13px] font-bold text-[var(--color-nv-bright)]">
        {n}
      </div>
      <div className="pt-1 text-[16px] font-bold leading-6 text-[var(--color-fg)]">{title}</div>
      <div className="[&>p:first-child]:mt-1.5 [&>p]:mb-2">{children}</div>
    </div>
  );
}
