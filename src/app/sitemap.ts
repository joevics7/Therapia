import type { MetadataRoute } from "next";
import { listPosts, SITE } from "@/lib/blog";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await listPosts();
  return [
    { url: SITE, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE}/blog`, changeFrequency: "daily", priority: 0.8 },
    ...posts.map((p) => ({ url: `${SITE}/blog/${p.slug}`, lastModified: p.published_at ?? undefined, changeFrequency: "monthly" as const, priority: 0.7 })),
  ];
}
