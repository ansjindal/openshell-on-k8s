// A diagram from docs/*.svg (copied to public/diagrams by `npm run build`'s
// prebuild step), so the README and the lessons share the same pictures.
// The SVGs carry their own light background, so they read in both themes.
export function Figure({ src, alt, caption }: { src: string; alt: string; caption?: string }) {
  return (
    <figure className="my-6">
      <a href={src} target="_blank" rel="noreferrer" title="Open full size">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="w-full rounded-xl border border-[var(--color-line)] bg-white" />
      </a>
      {caption && <figcaption className="mt-2 text-center text-xs text-[var(--color-fg-mut)]">{caption}</figcaption>}
    </figure>
  );
}
