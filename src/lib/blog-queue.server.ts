import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { runExtraction } from "@/lib/blog-ai.server";

const MAX_ATTEMPTS = 3;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Takes the oldest saved text that isn't processed, runs the normal parser, and saves the result as a draft. */
export async function processNextInbox(db: SupabaseClient) {
  const next = await db.from("blog_inbox").select("id, content, attempts").eq("status", "not_processed").lt("attempts", MAX_ATTEMPTS)
    .order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (next.error) return { status: "error" as const, message: "Couldn't read the queue." };
  if (!next.data) return { status: "empty" as const };
  const item = next.data as { id: string; content: string; attempts: number };

  const fail = async (message: string) => {
    await db.from("blog_inbox").update({ attempts: item.attempts + 1, error: message.slice(0, 400) }).eq("id", item.id);
    return { status: "failed" as const, id: item.id, message };
  };

  let out;
  try { out = await runExtraction("", item.content); }
  catch (e) { return fail(e instanceof Error ? e.message : "The AI could not finish."); }

  let slug = SLUG.test(out.slug) ? out.slug.slice(0, 120) : "";
  const title = (out.title ?? "").trim().slice(0, 300), content = (out.cleaned_content ?? "").trim();
  if (!slug || !title || !content || !out.category_slug) return fail("The parser returned no slug, title, category or content.");

  // Never overwrite an existing article: add -2, -3… if the slug is taken.
  const base = slug;
  for (let n = 2; n < 50; n++) {
    const hit = await db.from("articles").select("slug").eq("slug", slug).maybeSingle();
    if (!hit.data) break;
    slug = `${base.slice(0, 110)}-${n}`;
  }

  const list = (v: unknown) => (Array.isArray(v) ? v : []).map((x) => String(x).trim().slice(0, 80)).filter(Boolean).slice(0, 12);
  const art = await db.from("articles").insert({
    slug, category_slug: String(out.category_slug).slice(0, 80), related_tool_slugs: list(out.related_tool_slugs),
    countries: list(out.countries).length ? list(out.countries) : ["nigeria"], published: false, published_at: null,
  });
  if (art.error) return fail("Couldn't save the draft.");
  const tr = await db.from("article_translations").insert({
    article_slug: slug, locale: "en", title, excerpt: String(out.excerpt ?? "").slice(0, 500), content,
    meta_description: String(out.meta_description ?? "").slice(0, 300),
    reading_time_minutes: Math.min(120, Math.max(1, Math.round(Number(out.reading_time_minutes) || 5))), is_translated: true,
  });
  if (tr.error) { await db.from("articles").delete().eq("slug", slug); return fail("Couldn't save the article text."); }

  await db.from("blog_inbox").update({ status: "processed", article_slug: slug, error: null, processed_at: new Date().toISOString() }).eq("id", item.id);
  return { status: "processed" as const, slug };
}
