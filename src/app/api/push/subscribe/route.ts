import { NextResponse } from "next/server";
import { adminClient } from "@/lib/admin";
import { bearer } from "@/lib/server";
import { userClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function who(req: Request) {
  const jwt = bearer(req);
  if (!jwt) return null;
  const u = await userClient(jwt).auth.getUser(jwt);
  if (u.error || !u.data.user || u.data.user.is_anonymous) return null;
  return u.data.user.id;
}

/** Saves this device so reminders can reach it. */
export async function POST(req: Request) {
  const uid = await who(req);
  if (!uid) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const db = adminClient();
  if (!db) return NextResponse.json({ error: "Not available." }, { status: 503 });
  let b: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } = {};
  try { b = await req.json(); } catch { /* below */ }
  const endpoint = typeof b.endpoint === "string" ? b.endpoint : "";
  const p256dh = typeof b.keys?.p256dh === "string" ? b.keys.p256dh : "";
  const auth = typeof b.keys?.auth === "string" ? b.keys.auth : "";
  if (!/^https:\/\//.test(endpoint) || endpoint.length > 1000 || !p256dh || !auth) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  // keep a small number of devices per person
  const have = await db.from("push_subscriptions").select("id", { count: "exact", head: true }).eq("user_id", uid);
  if ((have.count ?? 0) >= 8) return NextResponse.json({ error: "Too many devices." }, { status: 429 });
  const r = await db.from("push_subscriptions").upsert({ user_id: uid, endpoint, p256dh, auth }, { onConflict: "endpoint" });
  if (r.error) return NextResponse.json({ error: "Couldn't save." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** Forgets this device. */
export async function DELETE(req: Request) {
  const uid = await who(req);
  if (!uid) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const db = adminClient();
  if (!db) return NextResponse.json({ error: "Not available." }, { status: 503 });
  let endpoint = "";
  try { endpoint = String((await req.json()).endpoint ?? ""); } catch { /* below */ }
  if (!endpoint) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  await db.from("push_subscriptions").delete().eq("user_id", uid).eq("endpoint", endpoint);
  return NextResponse.json({ ok: true });
}
