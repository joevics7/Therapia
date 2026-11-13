import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { adminClient } from "@/lib/admin";
import { bearer, ROOM_ID } from "@/lib/server";
import { userClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "vent-voice";
const MAX_BYTES = 700_000; // about 60 seconds of speech
const TYPES: Record<string, string> = { "audio/webm": "webm", "audio/mp4": "m4a", "audio/ogg": "ogg", "audio/mpeg": "mp3" };
const J = (b: object, status = 200) => NextResponse.json(b, { status });

// Upload one voice note. The file is private. Only the server can read it back, and only for members of that group.
export async function POST(req: Request) {
  const jwt = bearer(req);
  if (!jwt) return J({ error: "Sign in first." }, 401);
  const room = new URL(req.url).searchParams.get("room") ?? "";
  if (!ROOM_ID.test(room)) return J({ error: "Group not found." }, 404);
  const type = (req.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  const ext = TYPES[type];
  if (!ext) return J({ error: "That audio format isn't supported." }, 415);
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BYTES) return J({ error: "That voice note is too long." }, 413);

  const sb = userClient(jwt);
  const { data: u, error: ue } = await sb.auth.getUser(jwt);
  if (ue || !u.user) return J({ error: "Sign in first." }, 401);
  const { data: ok } = await sb.rpc("rate_allow_me", { p_action: "vent_voice", p_max: 10, p_window_secs: 600 });
  if (ok === false) return J({ error: "Slow down a little." }, 429);
  const { data: acc } = await sb.rpc("room_access", { p_room: room });
  if (!acc?.ok) return J({ error: "Join the group first." }, 403);

  const buf = Buffer.from(await req.arrayBuffer());
  if (buf.length < 800 || buf.length > MAX_BYTES) return J({ error: "That voice note is too short or too long." }, 413);

  const db = adminClient();
  if (!db) return J({ error: "Voice notes aren't available right now." }, 503);
  const path = `${room}/${randomUUID()}.${ext}`;
  const up = await db.storage.from(BUCKET).upload(path, buf, { contentType: type, upsert: false });
  if (up.error) return J({ error: "Couldn't save your voice note. Try again." }, 500);
  const rec = await db.from("vent_uploads").insert({ path, room_id: room, user_id: u.user.id });
  if (rec.error) { await db.storage.from(BUCKET).remove([path]); return J({ error: "Couldn't save your voice note. Try again." }, 500); }
  return J({ path });
}

// A short-lived link to play one voice note. Only members of the group that owns it get one.
export async function GET(req: Request) {
  const jwt = bearer(req);
  if (!jwt) return J({ error: "Sign in first." }, 401);
  const path = new URL(req.url).searchParams.get("path") ?? "";
  if (!/^[a-z0-9-]{2,40}\/[0-9a-f-]{36}\.(webm|m4a|ogg|mp3)$/.test(path)) return J({ error: "Not found." }, 404);
  const sb = userClient(jwt);
  const { data: ok } = await sb.rpc("rate_allow_me", { p_action: "vent_play", p_max: 120, p_window_secs: 600 });
  if (ok === false) return J({ error: "Slow down a little." }, 429);
  // Row-level security only returns the post if this person is a member of its group.
  const post = await sb.from("vent_posts").select("id").eq("voice_path", path).maybeSingle();
  if (!post.data) return J({ error: "Not found." }, 404);
  const db = adminClient();
  if (!db) return J({ error: "Unavailable." }, 503);
  const s = await db.storage.from(BUCKET).createSignedUrl(path, 300);
  if (s.error || !s.data) return J({ error: "Couldn't load that voice note." }, 500);
  return J({ url: s.data.signedUrl });
}
