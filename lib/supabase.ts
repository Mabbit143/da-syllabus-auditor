"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null | undefined;

/** Browser client. Null when the Supabase env vars are missing, so the app still works signed out. */
export function supabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  client = url && key ? createClient(url, key) : null;
  if (client && typeof window !== "undefined") {
    let previousUserId: string | null = null;
    client.auth.onAuthStateChange((event, session) => {
      const userId = session?.user.id ?? null;
      const switchedAccount = previousUserId !== null && previousUserId !== userId;
      previousUserId = userId;
      if (event !== "SIGNED_OUT" && !switchedAccount) return;

      // Auth and device storage have separate lifetimes. Never leave an account's
      // audits/profile available to the next visitor or import them into their account.
      try {
        for (const storageKey of Object.keys(window.localStorage)) {
          if (storageKey.startsWith("da-syllabus-auditor.")) window.localStorage.removeItem(storageKey);
        }
      } catch (err) {
        console.error("[auth] clearing local account data failed:", err instanceof Error ? err.message : err);
      }
      // Discard every page's React state and in-flight responses, not just the
      // account label. Cloud-saved audits are untouched and reload on next sign-in.
      window.location.replace("/");
    });
  }
  return client;
}
