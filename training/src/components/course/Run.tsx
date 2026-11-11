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
import { ChevronDown, Loader2, Play } from "lucide-react";
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

  return (
    <div className="not-prose my-5 space-y-3">
      <div className="overflow-hidden rounded-lg border border-[var(--color-run-line)] bg-[var(--color-run-bg)]">
        <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-3 border-b border-[var(--color-run-line)] px-4 py-2 text-left">
          <ChevronDown size={14} className={`text-[var(--color-fg-mut)] transition ${open ? "" : "-rotate-90"}`} />
          <span className="rounded bg-[var(--color-nv)] px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-[#0a0d07]">RUN</span>
          <span className="text-sm text-[var(--color-fg-dim)]">Press Run to run {count === 1 ? "this command" : `these ${count || ""} commands`} on your lab VM.</span>
        </button>
        {open && (
          <div className="run-group space-y-2 p-4 text-sm text-[var(--color-fg-dim)]">
            <RunContext.Provider value={{ register }}>{children}</RunContext.Provider>
            <button onClick={runAll} disabled={running}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--color-nv-dim)] bg-[var(--color-run-btn)] py-2.5 text-sm font-semibold text-[var(--color-nv-bright)] transition hover:bg-[var(--color-run-btn-hover)] disabled:opacity-60">
              {running ? <><Loader2 size={15} className="animate-spin" /> Running…</> : <>Run <Play size={14} /></>}
            </button>
          </div>
        )}
      </div>
      {own && !step.hasOutput && (
        <pre className="m-0 max-h-80 overflow-auto whitespace-pre rounded-lg border border-[var(--color-out-line)] bg-[var(--color-out-bg)] px-4 py-3 font-mono text-[12px] text-[var(--color-term-fg)]">{own.text}</pre>
      )}
    </div>
  );
}
