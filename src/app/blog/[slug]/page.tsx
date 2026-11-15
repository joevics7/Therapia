import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getPost, niceDate, SITE } from "@/lib/blog";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = await getPost(slug);
  if (!p) return { title: "Article not found | Therapia", robots: { index: false } };
  const desc = p.meta_description || p.excerpt || undefined;
  return {
    title: `${p.title} | Therapia`,
    description: desc,
    alternates: { canonical: `${SITE}/blog/${p.slug}` },
    openGraph: { title: p.title, description: desc, url: `${SITE}/blog/${p.slug}`, type: "article", publishedTime: p.published_at ?? undefined, modifiedTime: p.updated_at, images: p.og_image_url ? [p.og_image_url] : undefined },
    twitter: { card: p.og_image_url ? "summary_large_image" : "summary", title: p.title, description: desc },
  };
}

export default async function BlogPost({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await getPost(slug);
  if (!p) notFound();
  const ld = {
    "@context": "https://schema.org", "@type": "Article", headline: p.title, description: p.meta_description || p.excerpt || undefined,
    datePublished: p.published_at ?? undefined, dateModified: p.updated_at, image: p.og_image_url ? [p.og_image_url] : undefined,
    mainEntityOfPage: `${SITE}/blog/${p.slug}`, publisher: { "@type": "Organization", name: "Therapia", url: SITE },
  };
  return (
    <div className="pg-narrow blog">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
      <div className="topbar">
        <Link className="wordmark display" href="/">Therapia</Link>
        <Link className="btn ghost sm" href="/blog">← All articles</Link>
      </div>
      <article>
        <div className="rc-cat">{p.category_slug.replace(/-/g, " ")}</div>
        <h1 className="display ptitle">{p.title}</h1>
        <p className="fine">{niceDate(p.published_at)} · {p.reading_time_minutes} min read</p>
        <div className="prose">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{ a: ({ href, children }) => (href?.startsWith("/") ? <Link href={href}>{children}</Link> : <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>) }}
          >
            {p.content}
          </ReactMarkdown>
        </div>
      </article>
      <div className="card blogcta">
        <p className="display" style={{ fontSize: 19, margin: 0 }}>You don&rsquo;t have to carry this alone</p>
        <p className="muted">Therapia has anonymous group meetings and chat. No real names needed.</p>
        <Link className="btn primary" href="/login?mode=up">Join Therapia</Link>
      </div>
      <p className="fine blog-disc">This article is for information and is not a substitute for professional help. If you or someone near you may be in danger, call 112.</p>
    </div>
  );
}
