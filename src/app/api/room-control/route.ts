import { RoomServiceClient, TokenVerifier } from "livekit-server-sdk";
import { NextResponse } from "next/server";
import { isHostKey, livekitEnv } from "@/lib/server";

export const runtime = "nodejs";

type Body = {
  action?: "allow" | "revoke" | "remove" | "end";
  roomId?: string;
  identity?: string;
  hostKey?: string;
  token?: string; // a participant may revoke their own speaking right by proving their token
};

export async function POST(req: Request) {
  const env = livekitEnv();
  if (!env) return NextResponse.json({ error: "Audio is not configured yet." }, { status: 503 });

  let b: Body;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const roomId = String(b.roomId ?? "");
  if (!roomId || !b.action) return NextResponse.json({ error: "Bad request." }, { status: 400 });

  const svc = new RoomServiceClient(env.httpUrl, env.key, env.secret);
  const host = isHostKey(b.hostKey);

  try {
    // Self step-down: allowed with the participant's own valid token.
    if (!host && b.action === "revoke" && b.token) {
      const claims = await new TokenVerifier(env.key, env.secret).verify(b.token);
      if (claims.video?.room !== roomId || !claims.sub) throw new Error("bad token");
      await svc.updateParticipant(roomId, claims.sub, undefined, {
        canPublish: false, canSubscribe: true, canPublishData: true,
      });
      return NextResponse.json({ ok: true });
    }

    if (!host) return NextResponse.json({ error: "Host key needed." }, { status: 403 });

    const identity = String(b.identity ?? "");
    if (b.action === "end") {
      await svc.deleteRoom(roomId);
    } else if (!identity) {
      return NextResponse.json({ error: "Bad request." }, { status: 400 });
    } else if (b.action === "remove") {
      await svc.removeParticipant(roomId, identity);
    } else {
      await svc.updateParticipant(roomId, identity, undefined, {
        canPublish: b.action === "allow", canSubscribe: true, canPublishData: true,
      });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "That didn't work. Try again." }, { status: 400 });
  }
}
