import { RoomServiceClient } from "livekit-server-sdk";
import { NextResponse } from "next/server";
import { hostIsIn, livekitEnv } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Which rooms are live right now, and how many people are listening.
// A room only counts as live while its facilitator is in it.
export async function GET() {
  const env = livekitEnv();
  if (!env) return NextResponse.json({ live: {}, configured: false });
  try {
    const svc = new RoomServiceClient(env.httpUrl, env.key, env.secret);
    const rooms = (await svc.listRooms()).filter((r) => r.numParticipants > 0);
    const live: Record<string, number> = {};
    await Promise.all(rooms.map(async (r) => {
      if (await hostIsIn(svc, r.name)) live[r.name] = Math.max(0, r.numParticipants - 1);
    }));
    return NextResponse.json({ live, configured: true });
  } catch {
    return NextResponse.json({ live: {}, configured: true, error: true });
  }
}
