import { NextResponse } from "next/server";
import { consoleSession } from "@/lib/console-session";
import { execSandboxCollect, callGateway } from "@/lib/grpc";

// Egress events live only in the sandbox's local OCSF log. We read a bounded
// tail on demand via ExecSandbox — NOT a persistent tail. The client calls this
// only while the Network tab is open (and polls only if Live is on), so load
// scales with open views, not with the number of sandboxes.

type Egress = {
  ts: string; kind: string; level: string; verdict: "allow" | "deny" | "info";
  binary: string; dst: string; reason: string; raw: string;
};

// 2026-06-18T16:01:36.886Z OCSF NET:OPEN [MED] DENIED /usr/bin/curl(88) -> gitlab.com:443 [policy:- engine:opa] [reason:...]
const LINE = /^(\S+)\s+OCSF\s+(\w+):(\w+)\s+\[(\w+)\]\s+(?:(DENIED|ALLOWED|BLOCKED)\s+)?(.*)$/;

function parse(text: string): Egress[] {
  const out: Egress[] = [];
  for (const raw of text.split("\n")) {
    const m = LINE.exec(raw.trim());
    if (!m) continue;
    const [, ts, kind, , level, v, rest] = m;
    const verdict = v === "DENIED" || v === "BLOCKED" ? "deny" : v === "ALLOWED" ? "allow" : "info";
    const bin = rest.match(/(\/\S+?)\(\d+\)/)?.[1] || "";
    // "… -> gitlab.com:443 […]" (with binary) or "host:port" (supervisor's own conn).
    const dst = rest.match(/->\s*([^\s[]+)/)?.[1] || rest.match(/^([a-z0-9.\-]+:\d+)/i)?.[1] || "";
    const reason = rest.match(/\[reason:([^\]]*)/)?.[1] || "";
    out.push({ ts, kind, level, verdict, binary: bin, dst, reason, raw });
  }
  return out;
}

export async function GET(req: Request, { params }: { params: Promise<{ name: string }> }) {
  const s = await consoleSession();
  const token = s.accessToken;
  // Exec is privileged — gate to admins (the gateway also enforces RBAC).
  if (!s.isAdmin) return NextResponse.json({ error: "admin role required" }, { status: 403 });
  const { name } = await params;

  const lines = Math.min(Number(new URL(req.url).searchParams.get("lines") || "400"), 2000);
  // Bounded, read-only tail of the OCSF events from the sandbox's local logs.
  const cmd = ["sh", "-lc", `grep -h 'OCSF' /var/log/openshell*.log 2>/dev/null | tail -n ${lines}`];
  try {
    // ExecSandbox requires the sandbox id (not the name); resolve it first.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = await callGateway<{ sandbox?: any }>("getSandbox", { name }, token);
    const id = sb?.sandbox?.metadata?.id;
    if (!id) return NextResponse.json({ error: "sandbox not found" }, { status: 404 });
    const { stdout, code } = await execSandboxCollect(id, cmd, token, 15);
    return NextResponse.json({ events: parse(stdout), exitCode: code });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
