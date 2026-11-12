"use client";
import { useContext, type ReactNode } from "react";
import { OutputContext, Printed } from "./course/Output";

// What a command printed when this lesson was written, on a lab VM like yours.
// Inside <Output> it becomes "What the command printed (recorded)"; on its own,
// an open "Expected output" fold. Names, ages and ids differ on your VM.
export function ExpectedOutput({ children, title }: { children: ReactNode; title?: string }) {
  const ctx = useContext(OutputContext);
  if (ctx.inside && ctx.mode === "yours") return null; // your run shows its own text
  if (ctx.inside) return <Printed title="What the command printed (recorded)" open={!ctx.collapsePrinted}>{children}</Printed>;
  return (
    <details className="rl-optitem rl-kcmds" open>
      <summary>{title ?? "Expected output (recorded on a lab VM like yours)"}</summary>
      <pre className="rl-kout">{children}</pre>
    </details>
  );
}
