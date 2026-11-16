import type { Metadata } from "next";
import Link from "next/link";
import { listPosts, niceDate, SITE } from "@/lib/blog";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Blog | Therapia",
  description: "Practical, plain-language articles on stress, anxiety, grief, relationships and getting support, written for Nigerians.",
  alternates: { canonical: `${SITE}/blog` },
  openGraph: { title: "Therapia blog", description: "Practical, plain-language articles on mental health and getting support.", url: `${SITE}/blog`, type: "website" },
};

export default async function BlogIndex() {
  const posts = await listPosts();
  return (
    <div className="pg-narrow blog">
      <div className="topbar">
        <Link className="wordmark display" href="/">Therapia</Link>
        <Link className="btn ghost sm" href="/dashboard">← Back to dashboard</Link>
      </div>
      <h1 className="display ptitle">Blog</h1>
      <p className="muted">Practical, plain-language articles on stress, anxiety, grief, relationships and finding support.</p>
      {posts.length === 0 && <p className="empty">New articles are coming soon.</p>}
      <div className="stack">
        {posts.map((p) => (
          <article className="card blogcard" key={p.slug}>
            <div className="rc-cat">{p.category_slug.replace(/-/g, " ")}</div>
            <h2 className="display" style={{ fontSize: 21, margin: "2px 0 6px" }}><Link href={`/blog/${p.slug}`}>{p.title}</Link></h2>
            {p.excerpt && <p className="muted">{p.excerpt}</p>}
            <div className="fine">{niceDate(p.published_at)} · {p.reading_time_minutes} min read</div>
          </article>
        ))}
      </div>
      <p className="fine blog-disc">Therapia articles are for information and are not a substitute for professional help. In an emergency, call 112.</p>
    </div>
  );
}
