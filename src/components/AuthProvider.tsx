"use client";

import type { Session } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase, supabaseConfigured } from "@/lib/supabase";

export type Role = "listener" | "facilitator" | "admin";
type Ctx = {
  ready: boolean;
  session: Session | null;
  isAnonymous: boolean;
  role: Role;
  /** null when fine; otherwise why an account could not start */
  error: string | null;
  signOut: () => Promise<void>;
};
const C = createContext<Ctx>({ ready: false, session: null, isAnonymous: true, role: "listener", error: null, signOut: async () => {} });
export const useAuth = () => useContext(C);

// One start-up at a time, even in React strict mode, so we never create two anonymous accounts.
let starting: Promise<{ session: Session | null; error: string | null }> | null = null;
function start() {
  if (!starting) {
    starting = (async () => {
      const sb = supabase();
      const { data } = await sb.auth.getSession();
      if (data.session) return { session: data.session, error: null };
      const { data: d, error } = await sb.auth.signInAnonymously();
      return { session: d.session ?? null, error: error ? error.message : d.session ? null : "Could not start an account." };
    })().finally(() => { starting = null; });
  }
  return starting;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<Role>("listener");

  const boot = useCallback(async () => {
    const r = await start();
    setSession(r.session);
    setError(r.error);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!supabaseConfigured) { setError("not_configured"); setReady(true); return; }
    boot();
    const { data } = supabase().auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "SIGNED_OUT") boot(); // after sign-out, start a fresh anonymous account
    });
    return () => data.subscription.unsubscribe();
  }, [boot]);

  const uid = session?.user.id;
  const anon = session?.user.is_anonymous ?? true;
  useEffect(() => {
    if (!uid || anon) { setRole("listener"); return; }
    supabase().from("profiles").select("role").eq("user_id", uid).maybeSingle()
      .then(({ data }) => setRole(((data?.role as Role) ?? "listener")));
  }, [uid, anon]);

  const signOut = useCallback(async () => { await supabase().auth.signOut(); }, []);

  return <C.Provider value={{ ready, session, isAnonymous: anon, role, error, signOut }}>{children}</C.Provider>;
}
