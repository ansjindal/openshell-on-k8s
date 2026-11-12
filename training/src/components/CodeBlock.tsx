"use client";
import { useState, useEffect, useRef, type ReactNode, isValidElement } from "react";
import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import yaml from "highlight.js/lib/languages/yaml";
import json from "highlight.js/lib/languages/json";
import "highlight.js/styles/github-dark.css";
import { useContext } from "react";
import { runInShell, runApiCheckStream } from "@/lib/labBus";
import { setStepDone, setStepOutput } from "@/lib/progress";
import { StepContext } from "@/components/course/Structure";
import { RunContext } from "@/components/course/Run";

hljs.registerLanguage("bash", bash);
hljs.registerLanguage("yaml", yaml);
hljs.registerLanguage("json", json);

function extractText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (isValidElement(node)) return extractText((node.props as { children?: ReactNode }).children);
  return "";
}

// Find the fence language from the inner <code class="language-xxx">.
function getLang(node: ReactNode): string {
  if (Array.isArray(node)) {
    for (const c of node) { const l = getLang(c); if (l) return l; }
    return "";
  }
  if (isValidElement(node)) {
    const cn = String((node.props as { className?: string }).className || "");
    const m = /language-([\w-]+)/.exec(cn);
    if (m) return m[1];
    return getLang((node.props as { children?: ReactNode }).children);
  }
  return "";
}

const SHELL_LANGS = ["bash", "sh", "shell", "console", "zsh"];
// Reference fences: highlighted like bash but NEVER runnable (for commands we show but
// don't want run from this lesson — e.g. "inspect/change later", or commands set elsewhere).
const REF_LANGS = ["bash-ref", "sh-ref", "ref"];
// Interactive fences: genuinely need a real PTY (an attached shell prompt,
// `sandbox create` with no trailing command, etc.) — "Run" (the one-shot,
// non-interactive /api/check exec) can't work here even with stdin closed;
// it'll just sit until the server-side timeout kills it. Shell-only.
const INTERACTIVE_LANGS = ["bash-interactive", "sh-interactive"];
// Map a fence language to a registered highlight.js grammar (or null = render plain).
function hljsLang(lang: string): string | null {
  if (lang === "" || SHELL_LANGS.includes(lang) || REF_LANGS.includes(lang) || INTERACTIVE_LANGS.includes(lang)) return "bash";
  if (lang === "yaml" || lang === "yml") return "yaml";
  if (lang === "json") return "json";
  return null; // text, md, … → no highlighting
}

// Override for MDX <pre>: syntax-highlighted code with a Copy toolbar, plus a "Run in
// shell" button on shell blocks that contain at least one real command. Non-shell fences
// (text, yaml, md, json) and comment-only blocks are illustrative — Copy only, no Run.
// Override for MDX <pre>. Shell fences become a RUN panel: the command(s), a
// full-width "Run" button that executes them on the lab VM (streamed through
// /api/check) and an OUTPUT panel with the live result. A successful run marks
// the enclosing Step done. bash-interactive fences open the cluster shell
// instead; bash-ref and non-shell fences are display-only (Copy).
export function CodeBlock({ children }: { children?: ReactNode }) {
  const code = extractText(children).replace(/\n$/, "");
  const lang = getLang(children);
  const step = useContext(StepContext);
  const group = useContext(RunContext);
  const [copied, setCopied] = useState(false);
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState<{ stdout: string; stderr: string; exitCode: number | null } | null>(null);
  const [folded, setFolded] = useState(false);
  const outputRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (running && outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [output, running]);
  useEffect(() => {
    const clear = () => setOutput(null);
    window.addEventListener("osk8s:clear-outputs", clear);
    return () => window.removeEventListener("osk8s:clear-outputs", clear);
  }, []);

  const outRef = useRef("");
  async function runInline() {
    outRef.current = "";
    step.setLive({ text: "", exit: null });
    setRunning(true);
    setOutput({ stdout: "", stderr: "", exitCode: null });
    const { exitCode } = await runApiCheckStream(code, (stream, chunk) => {
      outRef.current += chunk;
      step.setLive({ text: outRef.current, exit: null });
      setOutput((prev) => {
        const base = prev ?? { stdout: "", stderr: "", exitCode: null };
        return stream === "stdout" ? { ...base, stdout: base.stdout + chunk } : { ...base, stderr: base.stderr + chunk };
      });
    });
    setOutput((prev) => ({ stdout: prev?.stdout ?? "", stderr: prev?.stderr ?? "", exitCode }));
    setRunning(false);
    step.setLive({ text: outRef.current, exit: exitCode });
    if (exitCode === 0 && step.id) {
      setStepOutput(step.id, String(code.length) + code.slice(0, 24), outRef.current);
      setStepDone(step.id, true);
    }
  }

  const isRef = REF_LANGS.includes(lang);
  const isInteractive = INTERACTIVE_LANGS.includes(lang);
  const isShell = lang === "" || SHELL_LANGS.includes(lang);
  const hasCommand = code.split("\n").some((l) => l.trim() !== "" && !/^\s*#/.test(l));
  const runnableInline = isShell && hasCommand && !isRef;
  const runnableShell = (isShell || isInteractive) && hasCommand && !isRef;
  const grammar = hljsLang(lang);
  const [html, setHtml] = useState<string | null>(null);
  useEffect(() => {
    if (!grammar) { setHtml(null); return; }
    try { setHtml(hljs.highlight(code, { language: grammar }).value); } catch { setHtml(null); }
  }, [code, grammar]);

  const copy = () => { navigator.clipboard?.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1400); };
  const codeEl = html
    ? <code className={`hljs language-${grammar}`} style={{ background: "transparent", padding: 0 }} dangerouslySetInnerHTML={{ __html: html }} />
    : <code>{code}</code>;

  // Tell the step which commands it runs, so its OUTPUT can show each with what it printed.
  useEffect(() => {
    if (runnableShell && step.addCmd) return step.addCmd(code);
  }, [runnableShell, code]); // eslint-disable-line react-hooks/exhaustive-deps
  // Inside <Run>: just the command; the group has the Run button.
  useEffect(() => {
    if (group && !REF_LANGS.includes(lang)) return group.register(code);
  }, [group, code, lang]);
  if (group) return <pre className="rl-code">{codeEl}</pre>;

  // Display-only blocks: YAML, JSON, reference commands, text.
  if (!runnableShell) {
    return (
      <div className="codewrap">
        <pre>{codeEl}</pre>
        <button onClick={copy} className="cbtn" title="Copy">{copied ? "Copied" : "Copy"}</button>
      </div>
    );
  }

  const say = running ? "Running on your lab VM…" : output && output.exitCode !== null
    ? (output.exitCode === 0 ? "Done. The output is below." : `It exited with code ${output.exitCode}. The output is below.`) : "";
  return (
    <div className="rl rl-read rl-res">
      <div className={`rl-box${folded ? " rl-folded" : ""}`}>
        <div className="rl-boxhead rl-foldh" tabIndex={0} role="button" aria-expanded={!folded} onClick={() => setFolded(!folded)}>
          <span className="rl-caret" />
          <span className="rl-badge do">{isInteractive ? "Shell" : "Run"}</span>
          <span className="rl-boxhint">{isInteractive ? "This one is interactive: it opens in the Cluster shell." : "Press Run to run this on your lab VM."}</span>
          <span className="rl-hbtns" onClick={(e) => e.stopPropagation()}>
            {runnableInline && <button onClick={() => runInShell(code)} title="Send to the Cluster shell instead (to edit it or keep state)">Shell</button>}
            <button onClick={copy} title="Copy">{copied ? "Copied" : "Copy"}</button>
          </span>
        </div>
        <div className="rl-boxbody">
          <div className="rl-kcmdlist"><pre className="rl-code">{codeEl}</pre></div>
          <div className="rl-ctrl">
            <button className="rl-run" type="button" disabled={running} onClick={runnableInline ? runInline : () => runInShell(code)}>
              {running ? "Running…" : runnableInline ? "Run ▷" : "Open in the Cluster shell ▷"}
            </button>
            {say && <div className={`rl-say ${running ? "wait" : output?.exitCode === 0 ? "ok" : "error"}`}>{say}</div>}
          </div>
        </div>
      </div>

      {output && !step.hasOutput && (
        <div className="rl-box rl-ktourout">
          <div className="rl-boxhead rl-foldh"><span className="rl-caret" /><span className="rl-badge do">Output</span>
            <span className="rl-boxhint">{output.exitCode === null ? "Running on your lab VM…" : `From your lab VM · exit ${output.exitCode}`}</span>
            <span className="rl-hbtns"><button onClick={() => setOutput(null)} title="Clear this output">Clear</button></span>
          </div>
          <div className="rl-boxbody">
            <pre ref={outputRef} className="rl-kout">{output.stdout}{output.stderr && <span className={output.exitCode ? "rl-err" : ""}>{output.stdout ? "\n" : ""}{output.stderr}</span>}{!output.stdout && !output.stderr && "(no output yet)"}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
