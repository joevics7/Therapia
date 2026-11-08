"use client";

import Link from "next/link";
import { useRoom } from "@/lib/hooks";
import RequireAuth from "./RequireAuth";
import { supabaseConfigured } from "@/lib/supabase";
import ChatClient from "./ChatClient";
import RoomClient from "./RoomClient";

function Gate({ id, children }: { id: string; children: (room: NonNullable<ReturnType<typeof useRoom>["room"]>) => React.ReactNode }) {
  const { room, status } = useRoom(id);
  if (!supabaseConfigured) return <div className="pg-narrow"><p className="err">Accounts aren&rsquo;t set up yet. Add the Supabase values to .env.local.</p></div>;
  if (status === "loading") return <div className="pg-narrow"><p className="muted">Loading…</p></div>;
  if (!room) return (<div className="pg-narrow"><p className="display ptitle">Group not found</p><Link className="btn ghost" href="/groups">← Groups</Link></div>);
  return <>{children(room)}</>;
}

export const LiveRoomEntry = ({ id }: { id: string }) => <RequireAuth><Gate id={id}>{(room) => <RoomClient room={room} />}</Gate></RequireAuth>;
export const ChatEntry = ({ id }: { id: string }) => <RequireAuth><Gate id={id}>{(room) => <ChatClient room={room} />}</Gate></RequireAuth>;
