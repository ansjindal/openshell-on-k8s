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
import { StepContext } from "./Structure";

export const OutputContext = createContext<{ inside: boolean; collapsePrinted: boolean; markDiagram: () => () => void; cmds?: string[] }>({ inside: false, collapsePrinted: false, markDiagram: () => () => {} });

export function Output({ summary, children }: { summary?: ReactNode; children?: ReactNode }) {
  const { live, markOutput, cmds } = useContext(StepContext);
  const [open, setOpen] = useState(true);
  // Children register themselves (a server-rendered page hands us lazy
  // references, so their types can't be inspected).
  useEffect(() => markOutput(), [markOutput]);
  const [diagrams, setDiagrams] = useState(0);
  const markDiagram = useCallback(() => { setDiagrams((n) => n + 1); return () => setDiagrams((n) => n - 1); }, []);
  const running = !!live && live.exit === null;
  const hint = !live ? "As recorded on a lab VM like yours." : running ? "Running on your lab VM…" : `From your lab VM · exit ${live.exit}`;
  return (
    <div className={`rl-box rl-ktourout${open ? "" : " rl-folded"}`}>
      <div className="rl-boxhead rl-foldh" tabIndex={0} role="button" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="rl-caret" /><span className="rl-badge do">Output</span><span className="rl-boxhint">{hint}</span>
      </div>
      <div className="rl-boxbody">
        {live && (
          <details className="rl-optitem rl-kcur" open>
            <summary>Your output</summary>
            <div className="rl-kresult"><div className="rl-ktour">
              <div className="rl-kcap"><span className={`rl-kdot${live.exit === 0 ? " ok" : ""}`} /><span>{running ? "Running on your lab VM…" : `From your lab VM · exit ${live.exit}`}</span></div>
              <pre className="rl-kout">{live.text || (running ? "" : "(no output)")}</pre>
            </div></div>
          </details>
        )}
        <details className="rl-optitem rl-kcur" open={!live}>
          <summary>Recorded output</summary>
          <div className="rl-kresult"><div className="rl-ktour">
            <div className="rl-kcap"><span className="rl-kdot rec" /><span>Recorded on a lab VM (n2d-standard-8, OpenShell 0.1.7)</span></div>
            <OutputContext.Provider value={{ inside: true, collapsePrinted: true, markDiagram, cmds }}>
              {summary && <div className="rl-ktourbody"><div className="rl-ctext">{summary}</div></div>}
              {children}
            </OutputContext.Provider>
          </div></div>
        </details>
      </div>
    </div>
  );
}
Output.displayName = "Output";

/** "What the command printed": each of the step's commands, then what it printed. */
export function Printed({ title, open: initial, children }: { title: string; open?: boolean; children: ReactNode }) {
  const { cmds } = useContext(OutputContext);
  return (
    <details className="rl-optitem rl-kcmds" open={!!initial}>
      <summary>{title}</summary>
      {cmds && cmds.length === 1 && <pre className="rl-code"><code>{cmds[0]}</code></pre>}
      <pre className="rl-kout">{children}</pre>
    </details>
  );
}
