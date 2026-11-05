import { AccessToken } from "livekit-server-sdk";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getRoom } from "@/lib/rooms";
import { cleanHandle, isHostKey, livekitEnv, safeEqual } from "@/lib/server";

export const runtime = "nodejs";

// Issues a short-lived room token. No account, email or phone is involved.
// Everyone joins as a listener. Only a verified host can speak straight away.
export async function POST(req: Request) {
  const env = livekitEnv();
  if (!env) return NextResponse.json({ error: "Audio is not configured yet." }, { status: 503 });

  let body: { roomId?: string; handle?: string; code?: string; hostKey?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const room = getRoom(String(body.roomId ?? ""));
  if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });

  const host = isHostKey(body.hostKey);

  if (room.women && !host) {
    const real = process.env.WOMEN_INVITE_CODE;
    const given = String(body.code ?? "").trim().toUpperCase();
    if (!real || !given || !safeEqual(given, real.trim().toUpperCase())) {
      return NextResponse.json({ error: "That invite code didn't work." }, { status: 403 });
    }
  }

  const identity = randomUUID(); // random per join, never linked to a person
  const at = new AccessToken(env.key, env.secret, {
    identity,
    name: cleanHandle(body.handle),
    ttl: "3h",
    metadata: JSON.stringify({ role: host ? "host" : "listener" }),
  });
  at.addGrant({
    roomJoin: true,
    room: room.id,
    canSubscribe: true,
    canPublish: host,
    canPublishData: true,
    roomAdmin: false, // admin actions go through /api/room-control, which checks the host key
  });

  return NextResponse.json({ token: await at.toJwt(), url: env.url, host });
}
