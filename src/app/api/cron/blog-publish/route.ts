import { NextResponse } from "next/server";
import { adminClient } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Daily: publish drafts, oldest first. All of them by default; add &limit=N to publish at most N per call. */
async function run(req: Request) {
  const db = adminClient();
  if (!db) return NextResponse.json({ error: "Server not configured." }, { status: 503 });
  // Open URL, so we limit it ourselves: too-early calls do nothing.
  const ok = await db.rpc("rate_allow", { p_key: "blog:publish", p_max: 1, p_window_secs: 72000 });
  if (ok.data === false) return NextResponse.json({ status: "limited", message: "Already published within the last 20 hours." }, { status: 429 });
  const lim = parseInt(new URL(req.url).searchParams.get("limit") ?? "", 10);
  const limit = Number.isFinite(lim) && lim > 0 ? Math.min(lim, 100) : 100;
  const drafts = await db.from("articles").select("slug").eq("published", false).order("created_at", { ascending: true }).limit(limit);
  if (drafts.error) return NextResponse.json({ error: "Couldn't read drafts." }, { status: 500 });
  const slugs = (drafts.data ?? []).map((d) => d.slug as string);
  if (slugs.length === 0) return NextResponse.json({ status: "none", published: [] });
  const up = await db.from("articles").update({ published: true, published_at: new Date().toISOString() }).in("slug", slugs);
  if (up.error) return NextResponse.json({ error: "Couldn't publish." }, { status: 500 });
  return NextResponse.json({ status: "published", published: slugs });
}
export const GET = run;
export const POST = run;
