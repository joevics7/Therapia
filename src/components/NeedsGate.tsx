"use client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "./AuthProvider";
import { supabase } from "@/lib/supabase";

/** First time in the app after sign-up: ask what they need help with (once; skipping also counts as answered). */
export default function NeedsGate() {
  const { session, role, ready } = useAuth();
  const router = useRouter();
  const path = usePathname();
  const uid = ready && role === "listener" ? session?.user.id : undefined; // facilitators and admins aren't asked
  useEffect(() => {
    if (!uid) return;
    let stop = false;
    supabase().from("user_needs").select("user_id").maybeSingle().then((r) => {
      if (!stop && !r.error && !r.data) router.replace(`/welcome?next=${encodeURIComponent(path)}`);
    });
    return () => { stop = true; };
  }, [uid, router, path]);
  return null;
}
