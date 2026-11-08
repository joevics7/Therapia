"use client";

import type { Session } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase, supabaseConfigured } from "@/lib/supabase";

export type Role = "listener" | "facilitator" | "admin";
type Ctx = {
  ready: boolean;
  session: Session | null;
  /** The person's username, or null for facilitator accounts (they sign in with email) */
  username: string | null;
  role: Role;
  /** "not_configured" when the Supabase values are missing, otherwise null */
  error: string | null;
  signOut: () => Promise<void>;
};
const C = createContext<Ctx>({ ready: false, session: null, username: null, role: "listener", error: null, signOut: async () => {} });
export const useAuth = () => useContext(C);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<Role>("listener");

  useEffect(() => {
    if (!supabaseConfigured) { setError("not_configured"); setReady(true); return; }
    const sb = supabase();
    sb.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const uid = session?.user.id;
  useEffect(() => {
    if (!uid) { setRole("listener"); return; }
    supabase().from("profiles").select("role").eq("user_id", uid).maybeSingle()
      .then(({ data }) => setRole(((data?.role as Role) ?? "listener")));
  }, [uid]);

  // After signing out, do a full reload to the home page so no signed-in screen or data stays in memory.
  const signOut = useCallback(async () => { await supabase().auth.signOut(); window.location.assign("/"); }, []);
  const meta = session?.user.user_metadata as { username?: string } | undefined;

  return <C.Provider value={{ ready, session, username: meta?.username ?? null, role, error, signOut }}>{children}</C.Provider>;
}
