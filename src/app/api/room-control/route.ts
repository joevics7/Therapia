import { RoomServiceClient, TokenVerifier } from "livekit-server-sdk";
import { NextResponse } from "next/server";
import { bearer, livekitEnv, ROOM_ID } from "@/lib/server";
import { userClient } from "@/lib/supabase";

export const runtime = "nodejs";

type Body = {
  action?: "allow" | "revoke" | "remove" | "end";
  roomId?: string;
  identity?: string; // the person's alias in this room
  token?: string; // a participant may stop their own speaking by proving their audio token
};

export async function POST(req: Request) {
  const env = livekitEnv();
  if (!env) return NextResponse.json({ error: "Audio is not configured yet." }, { status: 503 });

  let b: Body;
  try { b = await req.json(); } catch { return NextResponse.json({ error: "Bad request." }, { status: 400 }); }
  const roomId = String(b.roomId ?? "");
  if (!ROOM_ID.test(roomId) || !b.action) return NextResponse.json({ error: "Bad request." }, { status: 400 });

  const svc = new RoomServiceClient(env.httpUrl, env.key, env.secret);
  const perms = (canPublish: boolean) => ({ canPublish, canSubscribe: true, canPublishData: true });

  try {
    // Step down: allowed with your own valid audio token.
    if (b.action === "revoke" && b.token) {
      const claims = await new TokenVerifier(env.key, env.secret).verify(b.token);
      if (claims.video?.room !== roomId || !claims.sub) throw new Error("bad token");
      await svc.updateParticipant(roomId, claims.sub, undefined, perms(false));
      return NextResponse.json({ ok: true });
    }

    // Everything else is for the group's host (or an admin), decided by the database.
    const jwt = bearer(req);
    if (!jwt) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const uc = userClient(jwt);
    const { data: ok } = await uc.rpc("rate_allow_me", { p_action: "room-control", p_max: 120, p_window_secs: 60 });
    if (ok === false) return NextResponse.json({ error: "Slow down a little." }, { status: 429 });
    const { data: isHost } = await uc.rpc("is_room_host", { p_room: roomId });
    if (isHost !== true) return NextResponse.json({ error: "Only the host can do that." }, { status: 403 });

    const identity = String(b.identity ?? "");
    if (b.action === "end") {
      await svc.deleteRoom(roomId);
    } else if (!identity) {
      return NextResponse.json({ error: "Bad request." }, { status: 400 });
    } else if (b.action === "remove") {
      await svc.removeParticipant(roomId, identity);
    } else {
      await svc.updateParticipant(roomId, identity, undefined, perms(b.action === "allow"));
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "That didn't work. Try again." }, { status: 400 });
  }
}
