import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Public values (safe in the browser). Row-level security in the database is what protects the data.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const supabaseConfigured = !!SUPABASE_URL && !!SUPABASE_KEY;

// Placeholders keep the build working before the env vars exist.
const URL_ = SUPABASE_URL || "http://localhost:54321";
const KEY_ = SUPABASE_KEY || "missing-key";

let browser: SupabaseClient | null = null;
/** Browser client. Keeps the session on the device. */
export function supabase(): SupabaseClient {
  if (!browser) {
    browser = createClient(URL_, KEY_, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    });
  }
  return browser;
}

/** Server client for public reads (rooms, schedule). */
export function publicClient(): SupabaseClient {
  return createClient(URL_, KEY_, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Server client that acts as the signed-in user, so database rules apply to them. */
export function userClient(jwt: string): SupabaseClient {
  return createClient(URL_, KEY_, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
}
