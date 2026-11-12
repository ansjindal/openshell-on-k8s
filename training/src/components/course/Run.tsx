"use client";
// One RUN panel with several commands, each with a caption, and a single Run:
//   <Run>
//   Every node, with its status and version.
//   ```bash
//   kubectl get nodes
//   ```
//   The pods of the control plane.
//   ```bash
//   kubectl -n openshell get pods
//   ```
//   </Run>
// The fences inside register their commands here (see CodeBlock); Run executes
// them in order on the lab VM and feeds the step's OUTPUT panel.
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { runApiCheckStream } from "@/lib/labBus";
import { setStepDone, setStepOutput } from "@/lib/progress";
import { StepContext } from "./Structure";

export const RunContext = createContext<{ register: (code: string) => () => void } | null>(null);

export function Run({ children }: { children: ReactNode }) {
  const step = useContext(StepContext);
  const cmds = useRef<string[]>([]);
  const [count, setCount] = useState(0);
  const [running, setRunning] = useState(false);
  const [open, setOpen] = useState(true);
  const [own, setOwn] = useState<{ text: string; exit: number | null } | null>(null);
  const register = (code: string) => {
    cmds.current.push(code); setCount(cmds.current.length);
    return () => { cmds.current = cmds.current.filter((c) => c !== code); setCount(cmds.current.length); };
  };
  useEffect(() => {
    const clear = () => setOwn(null);
    window.addEventListener("osk8s:clear-outputs", clear);
    return () => window.removeEventListener("osk8s:clear-outputs", clear);
  }, []);

  async function runAll() {
    setRunning(true);
    let text = "";
    let exit = 0;
    const push = (r: { text: string; exit: number | null }) => { step.setLive(r); setOwn(r); };
    push({ text, exit: null });
    for (const c of cmds.current) {
      text += `${text ? "\n" : ""}$ ${c}\n`;
      const r = await runApiCheckStream(c, (_s, chunk) => { text += chunk; push({ text, exit: null }); });
      if (r.exitCode !== 0) { exit = r.exitCode; break; }
    }
    push({ text, exit });
    if (exit === 0 && step.id) { setStepOutput(step.id, "run", text); setStepDone(step.id, true); }
    setRunning(false);
  }

  const say = running ? "Running on your lab VM…" : own && own.exit !== null ? (own.exit === 0 ? "Done. The output is below." : `Stopped: exit ${own.exit}. The output is below.`) : "";
  return (
    <div className="rl rl-read rl-res">
      <div className={`rl-box${open ? "" : " rl-folded"}`}>
        <div className="rl-boxhead rl-foldh" tabIndex={0} role="button" aria-expanded={open} onClick={() => setOpen(!open)}>
          <span className="rl-caret" /><span className="rl-badge do">Run</span>
          <span className="rl-boxhint">Press Run to run {count === 1 ? "this command" : `these ${count || ""} commands`} on your lab VM.</span>
        </div>
        <div className="rl-boxbody">
          <div className="rl-kcmdlist"><RunContext.Provider value={{ register }}>{children}</RunContext.Provider></div>
          <div className="rl-ctrl">
            <button className="rl-run" type="button" onClick={runAll} disabled={running}>{running ? "Running…" : "Run ▷"}</button>
            {say && <div className={`rl-say ${running ? "wait" : own?.exit === 0 ? "ok" : "error"}`}>{say}</div>}
          </div>
        </div>
      </div>
      {own && !step.hasOutput && (
        <div className="rl-box rl-ktourout">
          <div className="rl-boxhead rl-foldh"><span className="rl-caret" /><span className="rl-badge do">Output</span><span className="rl-boxhint">From your lab VM</span></div>
          <div className="rl-boxbody"><pre className="rl-kout">{own.text}</pre></div>
        </div>
      )}
    </div>
  );
}
