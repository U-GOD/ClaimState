import { notFound } from "next/navigation";
import { extractHeadings, guides, neighbours } from "../../../lib/guides";
import { loadGuide } from "../../../lib/load-guide";
import { Markdown } from "../../markdown";

export function generateStaticParams() {
  return guides.map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = guides.find((item) => item.slug === slug);
  return { title: guide === undefined ? "ClaimState docs" : `${guide.title} · ClaimState docs` };
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const loaded = await loadGuide(slug);
  if (loaded === null) {
    notFound();
  }
  const guide = guides.find((item) => item.slug === loaded.slug)!;
  const headings = extractHeadings(loaded.markdown);
  const { previous, next } = neighbours(loaded.slug);

  return (
    <main className="content">
      <article className="article">
        <p className="crumb">{guide.chapter}</p>
        <Markdown source={loaded.markdown} />
        <nav className="pager" aria-label="Previous and next guide">
          {previous === undefined ? (
            <span />
          ) : (
            <a href={`/docs/${previous.slug}`}>
              <small>Previous</small>
              {previous.title}
            </a>
          )}
          {next === undefined ? (
            <span />
          ) : (
            <a className="pager-next" href={`/docs/${next.slug}`}>
              <small>Next</small>
              {next.title}
            </a>
          )}
        </nav>
        <footer className="article-foot">Signed lifecycle evidence. Not a title, a lien, or an assignment.</footer>
      </article>
      {headings.length > 0 ? (
        <aside className="toc" aria-label="On this page">
          <p className="toc-title">On this page</p>
          {headings.map((heading) => (
            <a key={heading.id} href={`#${heading.id}`} className={heading.depth === 3 ? "toc-sub" : undefined}>
              {heading.text}
            </a>
          ))}
        </aside>
      ) : null}
    </main>
  );
}
