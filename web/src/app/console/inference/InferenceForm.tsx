"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/console-api";

export function InferenceForm({ providers, current }: { providers: string[]; current: { providerName: string; modelId: string; timeoutSecs: number } }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [providerName, setProvider] = useState(current.providerName);
  const [modelId, setModel] = useState(current.modelId);
  const [timeoutSecs, setTimeout] = useState(String(current.timeoutSecs || 60));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save() {
    setMsg(null);
    const res = await fetch(api("/api/inference"), {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ providerName, modelId, timeoutSecs: Number(timeoutSecs) }),
    });
    const d = await res.json();
    if (!res.ok) setMsg({ ok: false, text: d.error ?? "failed" });
    else { setMsg({ ok: true, text: "Inference route updated." }); start(() => router.refresh()); }
  }

  return (
    <div className="panel"><div className="panel-body">
      <h2 style={{ margin: "0 0 16px", fontSize: 14 }}>Update route</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 620 }}>
        <div className="field">
          <label>Provider</label>
          {providers.length > 0 ? (
            <select value={providerName} onChange={(e) => setProvider(e.target.value)}>
              <option value="">Select provider…</option>
              {providers.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          ) : <input value={providerName} placeholder="provider name" onChange={(e) => setProvider(e.target.value)} />}
        </div>
        <div className="field">
          <label>Timeout (seconds)</label>
          <input value={timeoutSecs} onChange={(e) => setTimeout(e.target.value.replace(/\D/g, ""))} />
        </div>
        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <label>Model ID</label>
          <input value={modelId} placeholder="meta/llama-3.3-70b-instruct" onChange={(e) => setModel(e.target.value)} />
        </div>
      </div>
      <div className="actionbar">
        <button disabled={pending || !providerName || !modelId} onClick={save}>{pending ? "Saving…" : "Save route"}</button>
        {msg && <span style={{ fontSize: 12.5 }} className={msg.ok ? "" : "error"}>{msg.text}</span>}
      </div>
    </div></div>
  );
}
