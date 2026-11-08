"use client";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { fmtLagos, ROOM_COLS, type RoomDef, toRoom } from "./rooms";
import { supabase } from "./supabase";

/** Groups from the database, with each group's next dated session. Public: works before sign-in. */
export function useRooms() {
  const [rooms, setRooms] = useState<RoomDef[] | null>(null);
  useEffect(() => {
    let stop = false;
    (async () => {
      const sb = supabase();
      const since = new Date(Date.now() - 3600_000).toISOString();
      const [r, s] = await Promise.all([
        sb.from("rooms").select(ROOM_COLS).order("created_at"),
        sb.from("sessions").select("room_id,starts_at").gte("starts_at", since).order("starts_at"),
      ]);
      if (stop) return;
      const next: Record<string, string> = {};
      for (const x of (s.data ?? []) as { room_id: string; starts_at: string }[]) if (!next[x.room_id]) next[x.room_id] = fmtLagos(x.starts_at);
      setRooms(((r.data ?? []) as Record<string, unknown>[]).map((row) => ({ ...toRoom(row), next: next[String(row.id)] })));
    })();
    return () => { stop = true; };
  }, []);
  return rooms;
}

export type Booking = { id: string; pro_id: string; pro_name: string; slot: string; plan: "one" | "month"; price_ngn: number; status: string };

export function useBookings() {
  const { session } = useAuth();
  const [list, setList] = useState<Booking[]>([]);
  const uid = session?.user.id;
  useEffect(() => {
    if (!uid) return;
    supabase().from("bookings").select("id,pro_id,pro_name,slot,plan,price_ngn,status").order("created_at", { ascending: false })
      .then(({ data }) => setList((data ?? []) as Booking[]));
  }, [uid]);
  const add = useCallback(async (b: Omit<Booking, "id" | "status">) => {
    const { data, error } = await supabase().from("bookings").insert(b).select("id,pro_id,pro_name,slot,plan,price_ngn,status").single();
    if (error || !data) return false;
    setList((l) => [data as Booking, ...l]);
    return true;
  }, []);
  const cancel = useCallback(async (id: string) => {
    const { error } = await supabase().from("bookings").update({ status: "cancelled" }).eq("id", id);
    if (!error) setList((l) => l.map((x) => (x.id === id ? { ...x, status: "cancelled" } : x)));
    return !error;
  }, []);
  return { list, add, cancel, signedIn: !!uid };
}

export function useSaved() {
  const { session } = useAuth();
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const uid = session?.user.id;
  useEffect(() => {
    if (!uid) return;
    supabase().from("saved_items").select("item_id").then(({ data }) => {
      const m: Record<string, boolean> = {};
      for (const r of (data ?? []) as { item_id: string }[]) m[r.item_id] = true;
      setSaved(m);
    });
  }, [uid]);
  const toggle = useCallback(async (id: string) => {
    const was = !!saved[id];
    setSaved((s) => { const n = { ...s }; if (was) delete n[id]; else n[id] = true; return n; });
    const sb = supabase();
    const { error } = was ? await sb.from("saved_items").delete().eq("item_id", id) : await sb.from("saved_items").insert({ item_id: id });
    if (error) setSaved((s) => { const n = { ...s }; if (was) n[id] = true; else delete n[id]; return n; });
    return !error;
  }, [saved]);
  return { saved, toggle, signedIn: !!uid };
}

export function useReminders() {
  const { session } = useAuth();
  const [on, setOn] = useState<Record<string, boolean>>({});
  const uid = session?.user.id;
  useEffect(() => {
    if (!uid) return;
    supabase().from("reminders").select("room_id").then(({ data }) => {
      const m: Record<string, boolean> = {};
      for (const r of (data ?? []) as { room_id: string }[]) m[r.room_id] = true;
      setOn(m);
    });
  }, [uid]);
  const toggle = useCallback(async (roomId: string) => {
    const was = !!on[roomId];
    setOn((s) => { const n = { ...s }; if (was) delete n[roomId]; else n[roomId] = true; return n; });
    const sb = supabase();
    const { error } = was ? await sb.from("reminders").delete().eq("room_id", roomId) : await sb.from("reminders").insert({ room_id: roomId });
    if (error) setOn((s) => { const n = { ...s }; if (was) n[roomId] = true; else delete n[roomId]; return n; });
    return { ok: !error, now: !was };
  }, [on]);
  return { on, toggle, signedIn: !!uid };
}

/** One group by id. Public read, so it works before sign-in. */
export function useRoom(id: string) {
  const [state, setState] = useState<{ room: RoomDef | null; status: "loading" | "ready" | "missing" }>({ room: null, status: "loading" });
  useEffect(() => {
    let stop = false;
    (async () => {
      const sb = supabase();
      const [r, s] = await Promise.all([
        sb.from("rooms").select(ROOM_COLS).eq("id", id).maybeSingle(),
        sb.from("sessions").select("starts_at").eq("room_id", id).gte("starts_at", new Date(Date.now() - 3600_000).toISOString()).order("starts_at").limit(1),
      ]);
      if (stop) return;
      if (!r.data) { setState({ room: null, status: "missing" }); return; }
      const next = (s.data as { starts_at: string }[] | null)?.[0]?.starts_at;
      setState({ room: { ...toRoom(r.data as Record<string, unknown>), next: next ? fmtLagos(next) : undefined }, status: "ready" });
    })();
    return () => { stop = true; };
  }, [id]);
  return state;
}
