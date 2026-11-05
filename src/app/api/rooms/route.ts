import { RoomServiceClient } from "livekit-server-sdk";
import { NextResponse } from "next/server";
import { livekitEnv } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Which rooms are live right now, and how many people are in them.
export async function GET() {
  const env = livekitEnv();
  if (!env) return NextResponse.json({ live: {}, configured: false });
  try {
    const svc = new RoomServiceClient(env.httpUrl, env.key, env.secret);
    const rooms = await svc.listRooms();
    const live: Record<string, number> = {};
    for (const r of rooms) if (r.numParticipants > 0) live[r.name] = r.numParticipants;
    return NextResponse.json({ live, configured: true });
  } catch {
    return NextResponse.json({ live: {}, configured: true, error: true });
  }
}
