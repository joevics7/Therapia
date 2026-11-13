import { NextResponse } from "next/server";
import { adminClient } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Called by the database scheduler when voice files are left over (the post was deleted, expired, or never created).
 * It only ever removes files that no post points to, so calling it too often is harmless.
 */
export async function POST() {
  const db = adminClient();
  if (!db) return NextResponse.json({ status: "unavailable" });
  const ok = await db.rpc("rate_allow", { p_key: "vent:cleanup", p_max: 30, p_window_secs: 3600 });
  if (ok.data === false) return NextResponse.json({ status: "limited" });
  const orphans = await db.rpc("vent_orphan_uploads");
  const paths = ((orphans.data ?? []) as { path: string }[]).map((x) => x.path).slice(0, 200);
  if (paths.length === 0) return NextResponse.json({ status: "clean" });
  const rm = await db.storage.from("vent-voice").remove(paths);
  if (rm.error) return NextResponse.json({ status: "failed" }, { status: 500 });
  await db.from("vent_uploads").delete().in("path", paths);
  return NextResponse.json({ status: "removed", count: paths.length });
}
