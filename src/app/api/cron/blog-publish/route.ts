import { NextResponse } from "next/server";
import { adminClient } from "@/lib/admin";
import { cronAllowed } from "@/lib/cron.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Daily: publish drafts, oldest first. All of them by default; add &limit=N to publish at most N per call. */
async function run(req: Request) {
  const a = cronAllowed(req);
  if (a === "off") return NextResponse.json({ error: "CRON_SECRET is not set (16+ characters)." }, { status: 503 });
  if (a === "denied") return NextResponse.json({ error: "Not allowed." }, { status: 401 });
  const db = adminClient();
  if (!db) return NextResponse.json({ error: "Server not configured." }, { status: 503 });
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
