"use client";
// The single OUTPUT panel of a lab step:
//   <Output summary="This cluster has one node, Ready.">
//     <LiveDiagram id="deploy" layer={1} />
//     <ExpectedOutput>{`…what the command printed…`}</ExpectedOutput>
//   </Output>
// Before you run the step it shows what was recorded on a lab VM like yours.
// After Run it shows your VM's output (and the diagram fills in from it); the
// recorded text stays one click away.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { StepContext } from "./Structure";

export const OutputContext = createContext<{ inside: boolean; collapsePrinted: boolean; markDiagram: () => () => void }>({ inside: false, collapsePrinted: false, markDiagram: () => () => {} });

export function Output({ summary, children }: { summary?: ReactNode; children?: ReactNode }) {
  const { live, markOutput } = useContext(StepContext);
  const [open, setOpen] = useState(true);
  // Children register themselves (a server-rendered page hands us lazy
  // references, so their types can't be inspected).
  useEffect(() => markOutput(), [markOutput]);
  const [diagrams, setDiagrams] = useState(0);
  const markDiagram = useCallback(() => { setDiagrams((n) => n + 1); return () => setDiagrams((n) => n - 1); }, []);
  const hasDiagram = diagrams > 0;
  const running = live && live.exit === null;
  return (
    <div className="not-prose my-5 overflow-hidden rounded-[10px] border border-[var(--color-out-line)] bg-[var(--color-out-bg)]">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-3 bg-[var(--color-out-head)] px-3 py-[7px] text-left text-[13.5px]">
        <ChevronDown size={14} className={`text-[var(--color-fg-mut)] transition ${open ? "" : "-rotate-90"}`} />
        <span className="rounded bg-[var(--color-info)] px-[7px] py-0.5 text-[10.5px] font-bold text-white">OUTPUT</span>
        <span className="flex items-center gap-2 text-[13.5px] text-[var(--color-fg-dim)]">
          {!live && "As recorded on a lab VM like yours."}
          {running && <><Loader2 size={13} className="animate-spin text-[var(--color-nv-bright)]" /> Running on your lab VM…</>}
          {live && live.exit !== null && (live.exit === 0
            ? <><span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[var(--color-nv)] text-[9px] font-bold text-[#0a0d07]">✓</span> From your lab VM · exit 0</>
            : <><span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[9px] font-bold text-white">✕</span> From your lab VM · exit {live.exit}</>)}
        </span>
      </button>
      {open && (
        <div className="p-3">
          <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-ink2)] px-3 py-2.5">
            <div className="mb-2 flex items-center gap-2 border-b border-dashed border-[var(--color-line)] pb-2 text-sm font-semibold text-[var(--color-fg)]">
              {live ? "Your output" : "Recorded output"}
            </div>
            <div className="mb-2 flex items-center gap-2 text-xs text-[var(--color-fg-mut)]">
              <span className={`h-2 w-2 rounded-full ${live ? "bg-[var(--color-nv)]" : "bg-[var(--color-fg-mut)]"}`} />
              {live ? "From your lab VM" : "Recorded on a lab VM (n2d-standard-8, OpenShell 0.1.7)"}
            </div>
            {summary && <p className="mb-3 text-[13px] leading-[19.5px] text-[var(--color-fg-dim)]">{summary}</p>}
            {live && (
              <Printed title="What the command printed (your run)" open>
                {live.text || (running ? "" : "(no output)")}
              </Printed>
            )}
            <OutputContext.Provider value={{ inside: true, collapsePrinted: hasDiagram || !!live, markDiagram }}>
              {children}
            </OutputContext.Provider>
          </div>
        </div>
      )}
    </div>
  );
}
Output.displayName = "Output";

export function Printed({ title, open: initial, children }: { title: string; open?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(!!initial);
  return (
    <div className="my-3 overflow-hidden rounded-lg border border-[var(--color-line)]">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold text-[var(--color-fg)]">
        <ChevronDown size={14} className={`text-[var(--color-fg-mut)] transition ${open ? "" : "-rotate-90"}`} /> {title}
      </button>
      {open && (
        <pre className="m-0 max-h-80 overflow-auto whitespace-pre-wrap break-words border-t border-[var(--color-line)] bg-[var(--color-term-bg)] px-4 py-3 font-mono text-[12px] leading-relaxed text-[var(--color-term-fg)]">
          {children}
        </pre>
      )}
    </div>
  );
}
