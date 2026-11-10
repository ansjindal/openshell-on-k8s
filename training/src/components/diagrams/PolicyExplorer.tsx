"use client";
import { useState, type ReactNode } from "react";

// Interactive sandbox-policy explorer: the policy YAML on the left, click a section to see
// what it controls, whether it's static (locked at creation) or dynamic (hot-reloadable),
// and where it's enforced (OpenShell 0.1.x policy schema).

const NV = "#76b900", AMBER = "#e0a800", BLUE = "#6f8fd0", PURPLE = "#a78bfa", RED = "#ef6b6b";

type Sec = {
  id: string; lines: string[]; color: string; kind: "dynamic" | "static" | "note";
  title: string; enforce?: string; detail: ReactNode;
};

const SECS: Sec[] = [
  { id: "deny", color: "#8a93a3", kind: "note", title: "Deny-by-default",
    lines: ["# Deny-by-default: the agent can ONLY reach what's", "# listed here, only via the listed binaries.", ""],
    detail: <>Nothing is allowed until you allow it. No matching <code>network_policies</code> entry → the connection is blocked and logged. This is the whole posture: capability is opt-in, line by line.</> },
  { id: "net", color: NV, kind: "dynamic", title: "network_policies", enforce: "CONNECT proxy + OPA",
    lines: ["network_policies:", "  github-read:", "    name: github-read"],
    detail: <>Named blocks of allowed egress (a map: key = rule name). <strong>Dynamic</strong>: <code>openshell policy update</code> / <code>policy set</code> loads a new revision into a running sandbox, no restart. Each block = endpoints + binaries (+ L7 rules). Providers add their own blocks, named <code>_provider_&lt;name&gt;</code>.</> },
  { id: "ep", color: BLUE, kind: "dynamic", title: "endpoints", enforce: "L7 proxy",
    lines: ["    endpoints:", "      - host: api.github.com      # FQDN", "        port: 443", "        protocol: rest          # inspect requests (L7)", "        enforcement: enforce    # default is audit!"],
    detail: <>Which host:port may be reached. <code>protocol: rest</code> turns on request inspection (L7: method + path, even inside TLS); <code>protocol: tcp</code> or no protocol = connection-level (L4) only. <code>enforcement: enforce</code> blocks what breaks the rules; the default, <code>audit</code>, only logs it. <code>access: read-only | read-write | full</code> are presets instead of hand-written rules. Hosts must be FQDNs: sandbox DNS has no search domains.</> },
  { id: "bin", color: AMBER, kind: "dynamic", title: "binaries", enforce: "/proc/<pid>/exe SHA-256",
    lines: ["    binaries:", "      - /usr/bin/node", "      - /usr/local/bin/node"],
    detail: <>WHICH executables may use this endpoint: the supervisor resolves the calling process to its binary path (globs allowed, e.g. <code>/usr/bin/python3.*</code>). <code>git → github ✓</code> but <code>curl → github ✗</code>: this is what stops data exfil through an unexpected binary.</> },
  { id: "rules", color: PURPLE, kind: "dynamic", title: "rules", enforce: "L7 method+path",
    lines: ["        rules:", "          - allow: {method: GET, path: \"/repos/**\"}", "          # *  = one path segment, ** = any depth"],
    detail: <>The L7 allow-list: only these methods + path globs. A read-only copilot gets <code>GET /repos/**</code> and nothing else, so even a hijacked agent can't <code>POST</code> or <code>DELETE</code>. An exact path does not match deeper paths: <code>POST /pulls</code> does not allow <code>POST /pulls/1/merge</code>. <code>deny_rules</code> win over allow rules.</> },
  { id: "fs", color: RED, kind: "static", title: "filesystem", enforce: "Landlock LSM (kernel)",
    lines: ["filesystem_policy:", "  read_only:  [/usr, /lib, /etc]", "  read_write: [/sandbox, /tmp]"],
    detail: <>Kernel-enforced via <strong>Landlock LSM</strong> — paths not listed are simply inaccessible, below the app layer. Guards against binary tampering + credential theft. <strong>Static</strong>: locked at creation; changing it recreates the sandbox.</> },
  { id: "proc", color: "#22d3ee", kind: "static", title: "process", enforce: "seccomp-BPF + privilege drop",
    lines: ["process:", "  run_as_user: sandbox      # non-root", "  run_as_group: sandbox"],
    detail: <>Runs as a non-root user (setuid/setgid drop; re-acquiring root fails) with a <strong>seccomp-BPF</strong> filter blocking dangerous syscalls (and <code>PR_SET_NO_NEW_PRIVS</code>). Guards against priv-esc + fork bombs. <strong>Static</strong>: locked at creation.</> },
];

export function PolicyExplorer() {
  const [sel, setSel] = useState("net");
  const a = SECS.find((s) => s.id === sel)!;
  const tag = (k: Sec["kind"]) =>
    k === "dynamic" ? { t: "DYNAMIC · hot-reload", c: NV } : k === "static" ? { t: "STATIC · locked at creation", c: AMBER } : { t: "", c: "#8a93a3" };

  return (
    <figure className="my-6 rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
      <figcaption className="mb-3 text-sm text-[var(--color-fg-mut)]">A sandbox policy, section by section — click any block</figcaption>
      <div className="grid gap-3 lg:grid-cols-2">
        {/* the YAML */}
        <div className="overflow-hidden rounded-lg border border-[var(--color-line)] bg-[var(--color-bg-2)] py-2 font-mono text-[12px] leading-relaxed">
          {SECS.map((s) => (
            <button key={s.id} onClick={() => setSel(s.id)}
              className="block w-full px-3 py-0.5 text-left transition"
              style={{ background: sel === s.id ? `${s.color}1f` : "transparent",
                       borderLeft: `3px solid ${sel === s.id ? s.color : "transparent"}` }}>
              {s.lines.map((ln, i) => (
                <div key={i} className="whitespace-pre" style={{ color: ln.trim().startsWith("#") ? "var(--color-fg-mut)" : "var(--color-fg-dim)" }}>{ln || " "}</div>
              ))}
            </button>
          ))}
        </div>
        {/* the explanation */}
        <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-bg-2)] p-4 text-sm text-[var(--color-fg-dim)]">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold" style={{ color: a.color }}>{a.title}</span>
            {a.kind !== "note" && (
              <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: `${tag(a.kind).c}22`, color: tag(a.kind).c }}>{tag(a.kind).t}</span>
            )}
            {a.enforce && <span className="rounded bg-[var(--color-panel)] px-1.5 py-0.5 text-[10px] text-[var(--color-fg-mut)]">enforced: {a.enforce}</span>}
          </div>
          <div>{a.detail}</div>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-[var(--color-fg-mut)]">
        Two halves: <strong>network_policies</strong> hot-reload on a running sandbox; <strong>filesystem</strong> + <strong>process</strong> lock at creation (kernel-level: Landlock + seccomp). Together that's the defense-in-depth that bounds an autonomous agent.
      </p>
    </figure>
  );
}
