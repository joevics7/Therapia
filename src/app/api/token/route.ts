import { AccessToken } from "livekit-server-sdk";
import { NextResponse } from "next/server";
import { bearer, livekitEnv, ROOM_ID } from "@/lib/server";
import { userClient } from "@/lib/supabase";

export const runtime = "nodejs";

// Issues a short-lived audio token. The database decides who is a member and who is the host.
// The audio identity is the person's per-group alias, so nobody can be linked across groups.
export async function POST(req: Request) {
  const env = livekitEnv();
  if (!env) return NextResponse.json({ error: "Audio is not configured yet." }, { status: 503 });

  const jwt = bearer(req);
  if (!jwt) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  let roomId = "";
  try { roomId = String((await req.json()).roomId ?? ""); } catch { /* handled below */ }
  if (!ROOM_ID.test(roomId)) return NextResponse.json({ error: "Room not found." }, { status: 404 });

  const sb = userClient(jwt);
  const { data: u, error: uerr } = await sb.auth.getUser(jwt);
  if (uerr || !u.user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const { data: acc } = await sb.rpc("room_access", { p_room: roomId });
  if (!acc?.ok) return NextResponse.json({ error: "Join the group first." }, { status: 403 });

  const host = !!acc.is_host;
  const at = new AccessToken(env.key, env.secret, {
    identity: String(acc.alias),
    name: String(acc.handle),
    ttl: "3h",
    metadata: JSON.stringify({ role: host ? "host" : "listener" }),
  });
  at.addGrant({
    roomJoin: true,
    room: roomId,
    canSubscribe: true,
    canPublish: host,
    canPublishData: true,
    roomAdmin: false, // admin actions go through /api/room-control, which asks the database if you are the host
  });

  return NextResponse.json({ token: await at.toJwt(), url: env.url, host });
}
