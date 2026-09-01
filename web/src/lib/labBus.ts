// Tiny client-side bus that lets an MDX command block inject a command into the
// live lab terminal. The Terminal registers a sender when its WebSocket opens;
// command blocks call runInShell(). Commands issued before the shell is live are
// queued and flushed on connect (and the shell is auto-launched).
type Sender = (text: string) => void;

let sender: Sender | null = null;
const queue: string[] = [];

export function registerShellSender(s: Sender | null) {
  sender = s;
  if (s) while (queue.length) s(queue.shift()!);
}

export function runInShell(text: string) {
  const cmd = text.replace(/\s+$/, "");
  if (!cmd) return;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("oclaw:start-shell"));
  }
  if (sender) sender(cmd);
  else queue.push(cmd);
}

// Streams a command's output as it's produced (NDJSON: one {stream, chunk} line
// per burst, then a final {done: true, exitCode}) — long-running commands
// (sandbox create, …) show progress instead of one dump once they finish.
export async function runApiCheckStream(
  cmd: string,
  onChunk: (stream: "stdout" | "stderr", text: string) => void
): Promise<{ exitCode: number }> {
  try {
    const r = await fetch("/api/check", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cmd }),
    });
    if (!r.body) {
      const j = await r.json().catch(() => ({}));
      return { exitCode: j.exitCode ?? 1 };
    }
    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let exitCode = 1;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, idx);
        buf = buf.slice(idx + 1);
        if (!line) continue;
        try {
          const obj = JSON.parse(line);
          if (obj.done) exitCode = obj.exitCode ?? 1;
          else if (obj.chunk) onChunk(obj.stream, obj.chunk);
        } catch { /* ignore a partial/malformed line */ }
      }
    }
    return { exitCode };
  } catch (e) {
    onChunk("stderr", String(e));
    return { exitCode: 1 };
  }
}
