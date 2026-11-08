"use client";

import Link from "next/link";
import { useRoom } from "@/lib/hooks";
import { supabaseConfigured } from "@/lib/supabase";
import ChatClient from "./ChatClient";
import RoomClient from "./RoomClient";

function Gate({ id, children }: { id: string; children: (room: NonNullable<ReturnType<typeof useRoom>["room"]>) => React.ReactNode }) {
  const { room, status } = useRoom(id);
  if (!supabaseConfigured) return <p className="err">Accounts aren&rsquo;t set up yet. Add the Supabase values to .env.local.</p>;
  if (status === "loading") return <p className="muted">Loading…</p>;
  if (!room) return (<><p className="display ptitle">Group not found</p><Link className="btn ghost" href="/groups">← Groups</Link></>);
  return <>{children(room)}</>;
}

export const LiveRoomEntry = ({ id }: { id: string }) => <Gate id={id}>{(room) => <RoomClient room={room} />}</Gate>;
export const ChatEntry = ({ id }: { id: string }) => <Gate id={id}>{(room) => <ChatClient room={room} />}</Gate>;
