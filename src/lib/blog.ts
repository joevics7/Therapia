import { publicClient } from "./supabase";

export const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.theraping.app").replace(/\/$/, "");

export type Post = {
  slug: string; category_slug: string; published_at: string | null; updated_at: string;
  title: string; excerpt: string | null; content: string; meta_description: string | null; og_image_url: string | null; reading_time_minutes: number;
};
export type PostCard = Pick<Post, "slug" | "category_slug" | "published_at" | "title" | "excerpt" | "reading_time_minutes">;

type Row = { slug: string; category_slug: string; published_at: string | null; updated_at: string; article_translations: Omit<Post, "slug" | "category_slug" | "published_at" | "updated_at">[] };

/** Published articles in English, newest first. Anyone can read these (the database allows it). */
export async function listPosts(): Promise<PostCard[]> {
  const { data } = await publicClient()
    .from("articles")
    .select("slug, category_slug, published_at, updated_at, article_translations!inner(title, excerpt, reading_time_minutes, locale)")
    .eq("published", true)
    .eq("article_translations.locale", "en")
    .order("published_at", { ascending: false });
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    slug: r.slug, category_slug: r.category_slug, published_at: r.published_at,
    title: r.article_translations[0].title, excerpt: r.article_translations[0].excerpt, reading_time_minutes: r.article_translations[0].reading_time_minutes,
  }));
}

export async function getPost(slug: string): Promise<Post | null> {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return null;
  const { data } = await publicClient()
    .from("articles")
    .select("slug, category_slug, published_at, updated_at, article_translations!inner(title, excerpt, content, meta_description, og_image_url, reading_time_minutes, locale)")
    .eq("slug", slug)
    .eq("published", true)
    .eq("article_translations.locale", "en")
    .maybeSingle();
  const r = data as unknown as Row | null;
  if (!r) return null;
  return { slug: r.slug, category_slug: r.category_slug, published_at: r.published_at, updated_at: r.updated_at, ...r.article_translations[0] };
}

export const niceDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" }) : "");
