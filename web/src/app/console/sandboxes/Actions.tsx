"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconPlus } from "@/components/console/icons";
import { api } from "@/lib/console-api";

type Provider = { name: string; type: string };

// Admin actions: a create panel (when no deleteName) or a delete button (per row).
export default function SandboxActions({ deleteName }: { deleteName?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [image, setImage] = useState("");
  const [providers, setProviders] = useState<Provider[]>([]);
  const [chosen, setChosen] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open && !deleteName && providers.length === 0) {
      fetch(api("/api/providers")).then((r) => r.json()).then((d) => setProviders(d.providers ?? [])).catch(() => {});
    }
  }, [open, deleteName, providers.length]);

  async function create() {
    setErr(null);
    const res = await fetch(api("/api/sandboxes"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, image: image || undefined, providers: chosen }),
    });
    if (!res.ok) setErr((await res.json()).error ?? "create failed");
    else { setName(""); setImage(""); setChosen([]); setOpen(false); start(() => router.refresh()); }
  }

  async function remove() {
    setErr(null);
    const res = await fetch(api(`/api/sandboxes/${encodeURIComponent(deleteName!)}`), { method: "DELETE" });
    if (!res.ok) setErr((await res.json()).error ?? "delete failed");
    else start(() => router.refresh());
  }

  if (deleteName) {
    return (
      <button className="danger sm" disabled={pending} onClick={remove} title={err ?? "Delete sandbox"}>
        {pending ? "…" : "Delete"}
      </button>
    );
  }

  if (!open) return <button onClick={() => setOpen(true)}><IconPlus width={16} height={16} /> New sandbox</button>;

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div className="modal">
      <h2>New sandbox</h2>
      <div className="field">
        <label>Name</label>
        <input autoFocus value={name} placeholder="my-sandbox" onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field">
        <label>Image <span className="muted">(optional)</span></label>
        <input value={image} placeholder="ghcr.io/nvidia/openshell-community/sandboxes/openclaw:latest" onChange={(e) => setImage(e.target.value)} />
      </div>
      {providers.length > 0 && (
        <div className="field">
          <label>Providers</label>
          <div className="chips">
            {providers.map((p) => {
              const on = chosen.includes(p.name);
              return (
                <button type="button" key={p.name} className={`chip ${on ? "on" : ""}`}
                  onClick={() => setChosen((c) => on ? c.filter((x) => x !== p.name) : [...c, p.name])}>
                  {p.name}{p.type ? <span className="muted"> · {p.type}</span> : null}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div className="actionbar" style={{ marginTop: 4 }}>
        <button disabled={pending || !name} onClick={create}>{pending ? "Creating…" : "Create sandbox"}</button>
        <button className="ghost" onClick={() => { setOpen(false); setErr(null); }}>Cancel</button>
      </div>
      {err && <div className="error" style={{ fontSize: 12, marginTop: 8 }}>{err}</div>}
      </div>
    </div>
  );
}
