"use client";
// A scene from the OpenShell talks as a reading flow: the steps are text on
// the left, the picture stays beside them, and it shows the step you are
// reading. No clicks: scroll down and the picture moves on, scroll back and it
// rewinds. Clicking a step jumps to it.
//   <ReadScene scene="agent" />        texts: lib/scene-steps.ts
import { useEffect, useRef, useState } from "react";
import { SCENE_STEPS } from "@/lib/scene-steps";

export function ReadScene({ scene }: { scene: string }) {
  const sc = SCENE_STEPS[scene];
  const [active, setActive] = useState(0); // 0 = the scene before any step
  const frame = useRef<HTMLIFrameElement>(null);
  const items = useRef<(HTMLDivElement | null)[]>([]);
  const send = (n: number) => frame.current?.contentWindow?.postMessage({ type: "osk8s-beat", n }, "*");

  useEffect(() => { send(active); }, [active]);
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.source === frame.current?.contentWindow && e.data?.type === "osk8s-ready") send(active);
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  });
  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      const seen = entries.filter((e) => e.isIntersecting).map((e) => Number((e.target as HTMLElement).dataset.n));
      if (seen.length) setActive(Math.max(...seen));
    }, { rootMargin: "-38% 0px -52% 0px" });
    items.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  if (!sc) return null;
  // captions often start by repeating their label ("Knowledge: …"); drop that
  const clean = (label: string, text: string) => {
    const t = text.replace(new RegExp("^" + label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "[:.]\\s*", "i"), "");
    return t === text ? text : t.charAt(0).toUpperCase() + t.slice(1);
  };
  const blocks = [{ label: sc.title, text: sc.intro }, ...sc.steps.map((s) => ({ label: s.label, text: clean(s.label, s.text) }))];
  return (
    <div className="not-prose my-8 grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
      <div>
        {blocks.map((b, i) => (
          <div key={i} data-n={i} ref={(el) => { items.current[i] = el; }} onClick={() => setActive(i)}
            className={`cursor-pointer border-l-2 py-4 pl-4 transition-all duration-300 ${i === active ? "border-[var(--color-nv)] opacity-100" : "border-[var(--color-line)] opacity-55 hover:opacity-80"}`}>
            {i > 0 && <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-nv-bright)]">Step {i} of {blocks.length - 1}</div>}
            <div className={`font-bold text-[var(--color-fg)] ${i === 0 ? "text-[18px]" : "text-[16px]"}`}>{b.label}</div>
            <p className="mt-1.5 text-[15px] leading-[25px] text-[var(--color-fg-dim)]">{b.text}</p>
          </div>
        ))}
        <div className="h-[30vh]" />
      </div>
      <div>
        <div className="sticky top-20">
          <div className="overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-ink2)]" style={{ aspectRatio: "1100 / 784" }}>
            <iframe ref={frame} src={`/scenes/${sc.src}.html?only=${scene}&mode=board`} title={sc.title} loading="lazy"
              className="h-full w-full border-0" />
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            {blocks.slice(1).map((_, i) => (
              <span key={i} className={`h-1.5 rounded-full transition-all ${i + 1 === active ? "w-6 bg-[var(--color-nv)]" : i + 1 < active ? "w-3 bg-[var(--color-nv-dim)]" : "w-3 bg-[var(--color-line-2)]"}`} />
            ))}
            <span className="ml-auto text-[12px] text-[var(--color-fg-mut)]">Scroll to follow the steps</span>
          </div>
        </div>
      </div>
    </div>
  );
}
