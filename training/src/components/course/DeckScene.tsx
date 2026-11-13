"use client";
// Animated scenes from the OpenShell talks, played in the lesson:
//   <DeckScene src="openshell" only="agent" title="What is an agent?" />
// src: public/scenes/<src>.html (openshell = the deep technical guide,
// sentry = OpenShell and NVIDIA Sentry). only: the scenes to show, in order.
// Click a step on the left, or Next / → inside the scene, to play it.
import { useState } from "react";
import { Maximize2, X } from "lucide-react";

export function DeckScene({ src, only, title }: { src: string; only: string; title?: string }) {
  const [big, setBig] = useState(false);
  const url = `/scenes/${src}.html?only=${encodeURIComponent(only)}`;
  return (
    <figure className="not-prose my-6">
      <div className="relative overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-ink2)]" style={{ aspectRatio: "16 / 9" }}>
        <iframe src={url} title={title ?? only} loading="lazy" className="absolute inset-0 h-full w-full border-0" />
        <button onClick={() => setBig(true)} title="Full screen"
          className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-md border border-[var(--color-line-2)] bg-black/70 px-2 py-1 text-[11px] text-[var(--color-fg-dim)] hover:text-[var(--color-fg)]">
          <Maximize2 size={11} /> Full screen
        </button>
      </div>
      <figcaption className="mt-2 text-[13px] text-[var(--color-fg-mut)]">
        Press <b className="text-[var(--color-fg-dim)]">Next</b> (or click inside and use →) to play each step; Replay starts the scene again.
      </figcaption>
      {big && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/85 p-4" onClick={() => setBig(false)}>
          <div className="relative w-full max-w-[min(1700px,calc((100vh-2rem)*16/9))]" style={{ aspectRatio: "16 / 9" }} onClick={(e) => e.stopPropagation()}>
            <iframe src={url} title={title ?? only} className="absolute inset-0 h-full w-full rounded-xl border border-[var(--color-line-2)]" />
            <button onClick={() => setBig(false)} className="absolute -top-8 right-0 inline-flex items-center gap-1 text-[13px] text-[var(--color-fg-dim)] hover:text-white"><X size={14} /> Close</button>
          </div>
        </div>
      )}
    </figure>
  );
}
