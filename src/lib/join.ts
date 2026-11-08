"use client";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { getHandle, newHandle, setHandle } from "./session";
import { supabase } from "./supabase";

export type Member = { alias: string; handle: string; isHost: boolean };

const MESSAGES: Record<string, string> = {
  code_required: "This group needs an invite code from its host.",
  bad_code: "That invite code didn't work. Ask your host for the current one.",
  too_many_attempts: "Too many tries. Please wait 10 minutes and try again.",
  blocked: "You can't join this group.",
  not_found: "This group isn't available.",
  not_signed_in: "Your account isn't ready yet. Try again in a moment.",
};

/** Membership in one group: check if you're in, and join (with a code for women-only groups). */
export function useMembership(roomId: string) {
  const { ready, session, error: authError } = useAuth();
  const [handle, setH] = useState("");
  const [member, setMember] = useState<Member | null>(null);
  const [checked, setChecked] = useState(false);
  const [needCode, setNeedCode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let h = getHandle();
    if (!h) { h = newHandle(); setHandle(h); }
    setH(h);
  }, []);

  const uid = session?.user.id;
  useEffect(() => {
    if (!ready) return;
    if (!uid) { setChecked(true); return; }
    supabase().rpc("room_access", { p_room: roomId }).then(({ data }) => {
      if (data?.ok) {
        setMember({ alias: data.alias, handle: data.handle, isHost: !!data.is_host });
        if (data.handle) setH((x) => x || data.handle);
      }
      setChecked(true);
    });
  }, [ready, uid, roomId]);

  const join = useCallback(async (code?: string): Promise<Member | null> => {
    setBusy(true);
    setError("");
    try {
      const { data, error: e } = await supabase().rpc("join_room", { p_room: roomId, p_handle: handle, p_code: code?.trim() || null });
      if (e) { setError("Couldn't join. Check your connection and try again."); return null; }
      if (!data?.ok) {
        if (data?.error === "code_required") setNeedCode(true);
        else if (data?.error === "bad_code") setNeedCode(true);
        setError(MESSAGES[data?.error as string] ?? "Couldn't join. Try again.");
        return null;
      }
      const m = { alias: data.alias as string, handle: data.handle as string, isHost: !!data.is_host };
      setMember(m);
      return m;
    } finally {
      setBusy(false);
    }
  }, [roomId, handle]);

  return { ready, checked, authError, handle, member, needCode, busy, error, join };
}
