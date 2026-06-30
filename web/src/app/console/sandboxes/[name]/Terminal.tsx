"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/console-api";
import "@xterm/xterm/css/xterm.css";

const b64ToBytes = (b64: string) => {
  const bin = atob(b64);
  const a = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
  return a;
};
const strToB64 = (s: string) => {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
};

export function Terminal({ name }: { name: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"connecting" | "connected" | "closed" | "error">("connecting");
  const [nonce, setNonce] = useState(0); // bump to reconnect

  useEffect(() => {
    let disposed = false;
    let es: EventSource | null = null;
    let sessionId = "";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let term: any, fit: any;
    const host = hostRef.current;
    if (!host) return;

    (async () => {
      const [{ Terminal: XTerm }, { FitAddon }] = await Promise.all([
        import("@xterm/xterm"),
        import("@xterm/addon-fit"),
      ]);
      if (disposed) return;
      term = new XTerm({
        cursorBlink: true, fontSize: 13, fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
        theme: { background: "#0a0c11", foreground: "#e8ecf3", cursor: "#38bdf8" },
      });
      fit = new FitAddon();
      term.loadAddon(fit);
      term.open(host);
      try { fit.fit(); } catch { /* noop */ }

      const post = (payload: Record<string, unknown>) =>
        fetch(api(`/api/sandboxes/${encodeURIComponent(name)}/terminal`), {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ sessionId, ...payload }), keepalive: true,
        }).catch(() => {});

      es = new EventSource(api(`/api/sandboxes/${encodeURIComponent(name)}/terminal?cols=${term.cols}&rows=${term.rows}`));
      es.addEventListener("session", (e) => { sessionId = (e as MessageEvent).data; setStatus("connected"); });
      es.onmessage = (e) => { try { term.write(b64ToBytes(e.data)); } catch { /* noop */ } };
      es.addEventListener("exit", () => { term.writeln("\r\n\x1b[90m[process exited]\x1b[0m"); setStatus("closed"); es?.close(); });
      es.addEventListener("end", () => { setStatus("closed"); es?.close(); });
      es.addEventListener("srverror", (e) => { term.writeln(`\r\n\x1b[31m[gateway error: ${(e as MessageEvent).data}]\x1b[0m`); setStatus("error"); es?.close(); });
      es.onerror = () => { if (status !== "closed") setStatus("error"); };

      term.onData((d: string) => { if (sessionId) post({ type: "stdin", data: strToB64(d) }); });
      term.onResize(({ cols, rows }: { cols: number; rows: number }) => { if (sessionId) post({ type: "resize", cols, rows }); });

      const onWinResize = () => { try { fit.fit(); } catch { /* noop */ } };
      window.addEventListener("resize", onWinResize);
      term.focus();

      // cleanup closure
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (host as any).__cleanup = () => {
        window.removeEventListener("resize", onWinResize);
        if (sessionId) post({ type: "close" });
        es?.close();
        try { term.dispose(); } catch { /* noop */ }
      };
    })();

    return () => {
      disposed = true;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const c = (host as any)?.__cleanup; if (c) c();
    };
  }, [name, nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="panel"><div className="panel-body">
      <div className="logbar">
        <span className={`pill ${status === "connected" ? "ready" : status === "error" ? "error" : "unknown"}`}>
          <span className="dot" />{status}
        </span>
        <span className="muted" style={{ fontSize: 12 }}>Interactive shell · runs as the sandbox user, through the gateway</span>
        {(status === "closed" || status === "error") && (
          <button className="ghost sm" onClick={() => { setStatus("connecting"); setNonce((n) => n + 1); }}>Reconnect</button>
        )}
      </div>
      <div ref={hostRef} className="xterm-host" />
    </div></div>
  );
}
