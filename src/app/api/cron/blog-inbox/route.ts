import { NextResponse } from "next/server";
import { adminClient } from "@/lib/admin";
import { processNextInbox } from "@/lib/blog-queue.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Hourly: parse the oldest saved text and save it as a draft. */
async function run(req: Request) {
  const db = adminClient();
  if (!db) return NextResponse.json({ error: "Server not configured." }, { status: 503 });
  // Open URL, so we limit it ourselves: too-early calls do nothing.
  const ok = await db.rpc("rate_allow", { p_key: "blog:inbox", p_max: 1, p_window_secs: 3000 });
  if (ok.data === false) return NextResponse.json({ status: "limited", message: "Already ran within the last 50 minutes." }, { status: 429 });
  const r = await processNextInbox(db);
  return NextResponse.json(r, { status: r.status === "error" ? 500 : 200 });
}
export const GET = run;
export const POST = run;
