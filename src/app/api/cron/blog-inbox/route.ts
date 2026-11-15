import { NextResponse } from "next/server";
import { adminClient } from "@/lib/admin";
import { processNextInbox } from "@/lib/blog-queue.server";
import { cronAllowed } from "@/lib/cron.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Hourly: parse the oldest saved text and save it as a draft. */
async function run(req: Request) {
  const a = cronAllowed(req);
  if (a === "off") return NextResponse.json({ error: "CRON_SECRET is not set (16+ characters)." }, { status: 503 });
  if (a === "denied") return NextResponse.json({ error: "Not allowed." }, { status: 401 });
  const db = adminClient();
  if (!db) return NextResponse.json({ error: "Server not configured." }, { status: 503 });
  const r = await processNextInbox(db);
  return NextResponse.json(r, { status: r.status === "error" ? 500 : 200 });
}
export const GET = run;
export const POST = run;
