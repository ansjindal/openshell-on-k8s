"use client";
import { useEffect, useRef, useState } from "react";
import { registerShellSender } from "@/lib/labBus";
import { Loader2, RotateCcw, Terminal as TerminalIcon } from "lucide-react";

type Status = "idle" | "connecting" | "live" | "closed" | "error";

// xterm palette that follows the site's light/dark theme.
function xtermTheme() {
  const light = typeof document !== "undefined" && document.documentElement.dataset.theme === "light";
  return light
    ? { background: "#f3f5f9", foreground: "#1f2937", cursor: "#4d7a00", green: "#4d7a00", brightGreen: "#76b900", selectionBackground: "#cde2a3" }
    // dark: the warm green-on-near-black palette from the gb200 lab terminal
    : { background: "#0a0d07", foreground: "#d6e4c4", cursor: "#92e600", green: "#76b900", brightGreen: "#92e600", selectionBackground: "#243018" };
}

export function Terminal({ title = "lab shell", fill = false, autoStart = false }: { title?: string; fill?: boolean; autoStart?: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [started, setStarted] = useState(autoStart);
  const [session, setSession] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  // fill: parent controls height (e.g. the fixed bottom dock sets an explicit
  // px/vh height on its wrapper) — the terminal just fills whatever it's given.
  const h = fill ? "h-full" : "h-[400px]";

  // A command block (runInShell) can ask the shell to launch via this event.
  useEffect(() => {
    const onStart = () => setStarted(true);
    window.addEventListener("oclaw:start-shell", onStart);
    return () => window.removeEventListener("oclaw:start-shell", onStart);
  }, []);

  useEffect(() => {
    if (!started || !hostRef.current) return;
    let term: import("@xterm/xterm").Terminal | undefined;
    let fit: import("@xterm/addon-fit").FitAddon | undefined;
    let ws: WebSocket | undefined;
    let ro: ResizeObserver | undefined;
    let onTheme: (() => void) | undefined;
    let disposed = false;
    setErr(null);
    setStatus("connecting");

    const proto = location.protocol === "https:" ? "wss" : "ws";
    const url = `${proto}://${location.host}/ws/term`;
    const watchdog = setTimeout(() => {
      if (!disposed && ws && ws.readyState !== WebSocket.OPEN) {
        setStatus("error");
        setErr(`Couldn't open ${url} after 8s — likely a proxy not forwarding WebSocket upgrades, or a stale page (hard-refresh).`);
        try { ws.close(); } catch {}
      }
    }, 8000);

    (async () => {
      try {
        const { Terminal: XTerm } = await import("@xterm/xterm");
        const { FitAddon } = await import("@xterm/addon-fit");
        await import("@xterm/xterm/css/xterm.css");
        if (disposed) return;

        term = new XTerm({
          // match the gb200 lab terminal: JetBrains Mono, 13px, tight default spacing, block cursor
          fontFamily: "var(--font-mono), 'JetBrains Mono', 'SF Mono', 'Menlo', 'Consolas', monospace",
          fontSize: 13,
          fontWeight: 400,
          fontWeightBold: 600,
          cursorBlink: true,
          scrollback: 5000,
          theme: xtermTheme(),
        });
        fit = new FitAddon();
        term.loadAddon(fit);
        term.open(hostRef.current!);
        fit.fit();
        // follow light/dark toggles live — setting options.theme alone doesn't
        // repaint already-rendered rows in some xterm versions, so force a
        // refresh or the canvas stays stuck on whatever theme it started with.
        onTheme = () => {
          try {
            if (!term) return;
            term.options.theme = xtermTheme();
            term.refresh(0, term.rows - 1);
          } catch {}
        };
        window.addEventListener("oclaw:theme", onTheme);
        term.write("\x1b[90mconnecting to " + url + " …\x1b[0m\r\n");

        ws = new WebSocket(url);
        ws.onopen = () => {
          clearTimeout(watchdog);
          setStatus("live");
          registerShellSender((text) => {
            if (ws!.readyState === 1) ws!.send(text.replace(/\n/g, "\r") + "\r");
          });
          const sendResize = () => { try { ws!.send(`\x00resize:${term!.cols}:${term!.rows}`); } catch {} };
          sendResize();
          ro = new ResizeObserver(() => { try { fit!.fit(); sendResize(); } catch {} });
          ro.observe(hostRef.current!);
        };
        ws.onmessage = (e) => term && term.write(typeof e.data === "string" ? e.data : new Uint8Array(e.data as ArrayBuffer));
        ws.onclose = () => { if (!disposed) setStatus("closed"); registerShellSender(null); };
        ws.onerror = () => { if (!disposed) setStatus("error"); };
        term.onData((d) => { if (ws && ws.readyState === 1) ws.send(d); });
      } catch (e) {
        if (!disposed) { setStatus("error"); setErr(String(e)); }
      }
    })();

    return () => {
      disposed = true;
      clearTimeout(watchdog);
      registerShellSender(null);
      if (onTheme) window.removeEventListener("oclaw:theme", onTheme);
      try { ro?.disconnect(); } catch {}
      try { ws?.close(); } catch {}
      try { term?.dispose(); } catch {}
    };
  }, [started, session]);

  const dot = status === "live" ? "#76b900" : status === "error" || status === "closed" ? "#ee0000" : "#8a93a3";
  const statusLabel = status === "live" ? "connected" : status;
  const reconnect = () => {
    if (!started) setStarted(true);
    else setSession((n) => n + 1);
  };

  return (
    <div className={`flex flex-col overflow-hidden rounded-lg border border-[var(--color-line)] bg-[var(--color-term-bg)] ${h}`}>
      <div className="flex items-center gap-2 border-b border-[var(--color-line)] px-3 py-2">
        <span className="font-mono text-[11px] tracking-wide text-[var(--color-fg-dim)]">{title}</span>
        <span className="ml-auto inline-flex items-center gap-1.5 text-[10px] font-medium text-[var(--color-fg-mut)]">
          <span className={status === "live" ? "animate-pulse" : ""} style={{ width: 6, height: 6, borderRadius: 6, background: dot, display: "inline-block" }} />
          {statusLabel}
        </span>
        {started && (
          <button
            onClick={reconnect}
            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-[var(--color-fg-mut)] transition hover:bg-[var(--color-bg-2)] hover:text-[var(--color-fg)]"
            title="Reconnect shell"
          >
            <RotateCcw size={12} />
          </button>
        )}
      </div>
      {!started ? (
        <button
          onClick={() => setStarted(true)}
          className="flex flex-1 items-center justify-center gap-2 text-sm text-[var(--color-fg-mut)] transition hover:text-[var(--color-fg)]"
        >
          <TerminalIcon size={14} /> Connect
        </button>
      ) : (
        <div className="min-h-0 flex-1 px-3 pb-2 pt-2.5">
          {status === "connecting" && (
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] text-[var(--color-fg-mut)]">
              <Loader2 size={11} className="animate-spin" /> connecting…
            </div>
          )}
          <div ref={hostRef} className="h-full w-full" />
          {err && <div className="px-1 py-2 text-xs text-red-400">{err}</div>}
        </div>
      )}
    </div>
  );
}
