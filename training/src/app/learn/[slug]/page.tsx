import { notFound } from "next/navigation";
import Link from "next/link";
import { ALL_LESSONS, lessonNeighbors } from "@/lib/curriculum";
import { mdxComponents } from "@/mdx-components";
import { LessonProvider } from "@/components/course/Structure";
import { CollapseAll } from "@/components/course/CollapseAll";
import { MarkComplete } from "@/components/course/LessonFooter";
import { ArrowLeft, ArrowRight } from "lucide-react";

export function generateStaticParams() {
  return ALL_LESSONS.map((l) => ({ slug: l.slug }));
}
export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const l = ALL_LESSONS.find((x) => x.slug === slug);
  return { title: l ? `${l.title} · OpenShell on Kubernetes` : "OpenShell on Kubernetes" };
}

export default async function LessonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { current, prev, next } = lessonNeighbors(slug);
  if (!current) notFound();

  let Content: React.ComponentType<{ components?: typeof mdxComponents }>;
  try {
    const mod = await import(`@/content/${slug}.mdx`);
    Content = mod.default;
  } catch {
    notFound();
  }

  return (
    <article className="w-full">
      <div className="crumb">
        {current.partTitle}
        {current.kind === "lab" && <> · <span className="labtag">LAB</span></>}
        {current.kind === "check" && <> · <span className="labtag">CHECK</span></>}
        {current.kind === "lab" && <CollapseAll />}
      </div>
      <LessonProvider slug={current.slug} number={current.number}>
        <div className="prose max-w-none">
          <h1>{current.slug.endsWith("-overview") ? <>Module {current.moduleN} · {current.partTitle.split(" · ").slice(1).join(" · ")}</> : current.title}</h1>
          <Content components={mdxComponents} />
        </div>
      </LessonProvider>
      <MarkComplete slug={current.slug} />

      <nav className="mt-12 flex items-stretch justify-between gap-4 border-t border-[var(--color-line)] pt-6">
        {prev ? (
          <Link href={`/learn/${prev.slug}`} className="group flex flex-1 flex-col rounded-lg border border-[var(--color-line)] p-4 transition hover:border-[var(--color-nv-dim)]">
            <span className="flex items-center gap-1 text-xs text-[var(--color-fg-mut)]"><ArrowLeft size={12} /> Previous</span>
            <span className="mt-1 text-sm font-medium text-[var(--color-fg-dim)] group-hover:text-[var(--color-fg)]">{prev.number} · {prev.title}</span>
          </Link>
        ) : <div className="flex-1" />}
        {next ? (
          <Link href={`/learn/${next.slug}`} className="group flex flex-1 flex-col items-end rounded-lg border border-[var(--color-line)] p-4 text-right transition hover:border-[var(--color-nv-dim)]">
            <span className="flex items-center gap-1 text-xs text-[var(--color-fg-mut)]">Next <ArrowRight size={12} /></span>
            <span className="mt-1 text-sm font-medium text-[var(--color-fg-dim)] group-hover:text-[var(--color-fg)]">{next.number} · {next.title}</span>
          </Link>
        ) : <div className="flex-1" />}
      </nav>
    </article>
  );
}
