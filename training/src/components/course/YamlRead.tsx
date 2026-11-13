"use client";
// A YAML file read part by part: the explanation runs down the left, the file
// stays beside it, and the lines of the part you are reading light up while
// the rest dims. No clicks: scroll and the file follows; click a part to jump.
//   <YamlRead id="pi-agent-deployment" />   parts: lib/yaml-reads.ts
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import hljs from "highlight.js/lib/core";
import yaml from "highlight.js/lib/languages/yaml";
import bash from "highlight.js/lib/languages/bash";
import "highlight.js/styles/github-dark.css";
import { YAML_READS } from "@/lib/yaml-reads";
import { YAML_FILES } from "@/lib/yaml-files.generated";

hljs.registerLanguage("yaml", yaml);
hljs.registerLanguage("bash", bash);

// `code` and **bold** in the part texts
function inline(text: string): ReactNode {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).map((t, i) =>
    t.startsWith("`") ? <code key={i}>{t.slice(1, -1)}</code>
      : t.startsWith("**") ? <b key={i} className="text-[var(--color-fg)]">{t.slice(2, -2)}</b>
      : <Fragment key={i}>{t}</Fragment>);
}

export function YamlRead({ id }: { id: string }) {
  const r = YAML_READS[id];
  const code = r ? (r.file ? YAML_FILES[r.file] : r.code) ?? "" : "";
  const lines = useMemo(() => code.split("\n"), [code]);
  const html = useMemo(() => lines.map((l) => hljs.highlight(l || " ", { language: r?.lang ?? "yaml" }).value), [lines, r?.lang]);
  // each part's lines: [from, to] anchors are text found in the file, in order
  const spans = useMemo(() => (r?.parts ?? []).map((p) => {
    const set = new Set<number>();
    for (const [from, to] of p.at) {
      // "=text" matches a whole (trimmed) line, anything else a part of one
      const m = (l: string, pat: string) => (pat.startsWith("=") ? l.trim() === pat.slice(1) : l.includes(pat));
      const a = lines.findIndex((l) => m(l, from));
      if (a < 0) continue;
      const b = to ? lines.findIndex((l, i) => i >= a && m(l, to)) : a;
      for (let i = a; i <= (b < 0 ? a : b); i++) set.add(i);
    }
    return set;
  }), [r, lines]);

  const [active, setActive] = useState(0); // 0 = the intro: the whole file
  const items = useRef<(HTMLDivElement | null)[]>([]);
  const pane = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      const seen = entries.filter((e) => e.isIntersecting).map((e) => Number((e.target as HTMLElement).dataset.n));
      if (seen.length) setActive(Math.max(...seen));
    }, { rootMargin: "-38% 0px -52% 0px" });
    items.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);
  const lit = active > 0 ? spans[active - 1] : undefined;
  // bring the lit lines into view inside the code pane
  useEffect(() => {
    const p = pane.current;
    if (!p) return;
    const first = lit && lit.size ? Math.min(...lit) : 0;
    const el = p.querySelector<HTMLElement>(`[data-line="${first}"]`);
    if (el) p.scrollTo({ top: Math.max(0, el.offsetTop - p.clientHeight * 0.22), behavior: "smooth" });
  }, [lit]);

  if (!r) return null;
  const blocks = [{ title: r.title, text: r.intro }, ...r.parts];
  return (
    <div className="not-prose my-8 grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
      <div>
        {blocks.map((b, i) => (
          <div key={i} data-n={i} ref={(el) => { items.current[i] = el; }} onClick={() => setActive(i)}
            className={`yr-part cursor-pointer border-l-2 py-4 pl-4 transition-all duration-300 ${i === active ? "border-[var(--color-nv)] opacity-100" : "border-[var(--color-line)] opacity-55 hover:opacity-80"}`}>
            {i > 0 && <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-nv-bright)]">{i} of {r.parts.length}</div>}
            <div className={`font-bold text-[var(--color-fg)] ${i === 0 ? "text-[18px]" : "text-[16px]"}`}>{b.title}</div>
            <p className="mt-1.5 text-[15px] leading-[25px] text-[var(--color-fg-dim)]">{inline(b.text)}</p>
          </div>
        ))}
        <div className="h-[30vh]" />
      </div>
      <div>
        <div className="sticky top-20">
          <div className="overflow-hidden rounded-[10px] border border-[var(--color-code-bd,var(--color-line))] bg-[var(--color-code-bg,var(--color-ink2))]">
            <div className="flex items-center gap-2 border-b border-[var(--color-line)] px-4 py-2 font-mono text-[12px] text-[var(--color-fg-mut)]">
              <span className="rounded bg-[var(--color-run-btn)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-nv-bright)]">{r.lang === "bash" ? "shell" : "yaml"}</span>
              {r.file ?? r.label}
            </div>
            <div ref={pane} className="relative max-h-[62vh] overflow-auto py-2">
              <pre className="!m-0 !rounded-none !border-0 !bg-transparent !p-0 !shadow-none font-mono text-[12.5px] leading-[20px]"><code className="hljs !block !rounded-none !border-0 !bg-transparent !p-0">
                {lines.map((_, i) => {
                  const on = lit?.has(i);
                  return (
                    <div key={i} data-line={i}
                      className={`flex border-l-[3px] pr-4 transition-all duration-300 ${on ? "border-[var(--color-nv)] bg-[rgba(118,185,0,0.13)]" : "border-transparent"} ${lit && !on ? "opacity-30" : ""}`}>
                      <span className="w-10 shrink-0 select-none pr-3 text-right text-[var(--color-fg-mut)]">{i + 1}</span>
                      <span className="whitespace-pre" dangerouslySetInnerHTML={{ __html: html[i] }} />
                    </div>
                  );
                })}
              </code></pre>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            {r.parts.map((_, i) => (
              <span key={i} className={`h-1.5 rounded-full transition-all ${i + 1 === active ? "w-6 bg-[var(--color-nv)]" : i + 1 < active ? "w-3 bg-[var(--color-nv-dim)]" : "w-3 bg-[var(--color-line-2)]"}`} />
            ))}
            <span className="ml-auto text-[12px] text-[var(--color-fg-mut)]">Scroll to follow the parts</span>
          </div>
        </div>
      </div>
    </div>
  );
}
