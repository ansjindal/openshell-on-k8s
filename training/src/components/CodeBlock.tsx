"use client";
import { useState, useEffect, useRef, type ReactNode, isValidElement } from "react";
import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import yaml from "highlight.js/lib/languages/yaml";
import json from "highlight.js/lib/languages/json";
import "highlight.js/styles/github-dark.css";
import { useContext } from "react";
import { ChevronDown, ChevronUp, Copy, Loader2, Play, Terminal as TerminalIcon, Trash2 } from "lucide-react";
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
  const [collapsed, setCollapsed] = useState(false);
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
    setCollapsed(false);
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
  const codeView = (
    <pre className="m-0 overflow-x-auto whitespace-pre rounded-[11px] border border-[var(--color-code-bd)] bg-[var(--color-code-bg)] px-[17.6px] py-4 font-mono text-[13px] leading-[20.8px]">
      {html
        ? <code className={`hljs language-${grammar}`} style={{ background: "transparent", padding: 0 }} dangerouslySetInnerHTML={{ __html: html }} />
        : <code className="text-[var(--color-code-fg)]">{code}</code>}
    </pre>
  );

  // Inside <Run>: just the command; the group has the Run button.
  useEffect(() => {
    if (group && !REF_LANGS.includes(lang)) return group.register(code);
  }, [group, code, lang]);
  if (group) return <div className="not-prose">{codeView}</div>;

  // Display-only blocks: YAML, JSON, reference commands, diagrams in text.
  if (!runnableShell) {
    return (
      <div className="not-prose my-5 overflow-hidden rounded-lg border border-[var(--color-line)] bg-[var(--color-code-bg)]">
        <div className="flex items-center justify-between px-3 py-1.5">
          <span className="font-mono text-[11px] uppercase tracking-wide text-[var(--color-fg-mut)]">{isRef ? "reference" : lang || "text"}</span>
          <button onClick={copy} className="inline-flex items-center gap-1 rounded border border-[var(--color-line-2)] px-2 py-0.5 text-[11px] text-[var(--color-fg-mut)] hover:text-[var(--color-fg)]">
            <Copy size={11} /> {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <div className="px-3 pb-3">{codeView}</div>
      </div>
    );
  }

  return (
    <div className="not-prose my-5 space-y-3">
      <div className="overflow-hidden rounded-[10px] border border-[var(--color-run-line)] bg-[var(--color-run-bg)]">
        <div className="flex items-center gap-3 bg-[var(--color-run-head)] px-3 py-[7px] text-[13.5px]">
          <span className={`rounded px-[7px] py-0.5 text-[10.5px] font-bold ${isInteractive ? "bg-[var(--color-info)] text-white" : "bg-[var(--color-nv)] text-[#0a0d07]"}`}>
            {isInteractive ? "SHELL" : "RUN"}
          </span>
          <span className="flex-1 text-[13.5px] text-[var(--color-fg-dim)]">
            {isInteractive ? "Interactive: this opens in the cluster shell." : "Press Run to run this on your lab VM."}
          </span>
          {runnableInline && (
            <button onClick={() => runInShell(code)} title="Send to the cluster shell instead (to edit or keep state)"
              className="inline-flex items-center gap-1 rounded border border-[var(--color-line-2)] px-2 py-0.5 text-[11px] text-[var(--color-fg-mut)] hover:text-[var(--color-fg)]">
              <TerminalIcon size={11} /> Shell
            </button>
          )}
          <button onClick={copy} className="inline-flex items-center gap-1 rounded border border-[var(--color-line-2)] px-2 py-0.5 text-[11px] text-[var(--color-fg-mut)] hover:text-[var(--color-fg)]">
            <Copy size={11} /> {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <div className="space-y-3 p-3">
          {codeView}
          <button
            onClick={runnableInline ? runInline : () => runInShell(code)}
            disabled={running}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--color-run-btn-line)] bg-[var(--color-run-btn)] py-3 text-[15px] font-bold text-[var(--color-nv-bright)] transition hover:bg-[var(--color-run-btn-hover)] disabled:opacity-60"
          >
            {running ? <><Loader2 size={15} className="animate-spin" /> Running…</> : runnableInline ? <>Run <Play size={14} /></> : <>Open in cluster shell <TerminalIcon size={14} /></>}
          </button>
        </div>
      </div>

      {output && !step.hasOutput && (
        <div className="overflow-hidden rounded-[10px] border border-[var(--color-out-line)] bg-[var(--color-out-bg)]">
          <div className="flex items-center gap-3 bg-[var(--color-out-head)] px-3 py-[7px]">
            <span className="rounded bg-[var(--color-info)] px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-white">OUTPUT</span>
            <span className="flex flex-1 items-center gap-2 text-sm text-[var(--color-fg-dim)]">
              {output.exitCode === null ? (
                <><Loader2 size={13} className="animate-spin text-[var(--color-nv-bright)]" /> Running on your lab VM…</>
              ) : output.exitCode === 0 ? (
                <><span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[var(--color-nv)] text-[9px] font-bold text-[#0a0d07]">✓</span> From your lab VM · exit 0</>
              ) : (
                <><span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[9px] font-bold text-white">✕</span> From your lab VM · exit {output.exitCode}</>
              )}
            </span>
            <button onClick={() => setCollapsed((c) => !c)} title={collapsed ? "Expand" : "Collapse"} className="text-[var(--color-fg-mut)] hover:text-[var(--color-fg)]">
              {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </button>
            <button onClick={() => setOutput(null)} title="Clear output" className="text-[var(--color-fg-mut)] hover:text-[var(--color-fg)]"><Trash2 size={13} /></button>
          </div>
          {!collapsed && (
            <pre ref={outputRef} className="m-0 max-h-80 overflow-auto whitespace-pre px-4 py-3 font-mono text-[12px] leading-relaxed text-[var(--color-term-fg)]">
              {output.stdout}
              {output.stderr && (
                <span style={{ color: output.exitCode === null || output.exitCode === 0 ? "var(--color-term-fg)" : "var(--color-rh-bright)" }}>
                  {output.stdout ? "\n" : ""}{output.stderr}
                </span>
              )}
              {!output.stdout && !output.stderr && <span className="text-[var(--color-fg-mut)]">(no output)</span>}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
