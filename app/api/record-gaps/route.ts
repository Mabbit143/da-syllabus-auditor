import { createClient } from "@supabase/supabase-js";
import { createRecordGapsHandler } from "@/lib/policy/record-gaps-handler";
import { isPublicHttp, pageText } from "@/lib/sources";

export const maxDuration = 30;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const POST = createRecordGapsHandler({
  authenticate: async (token) => {
    if (!token || !SUPABASE_URL || !ANON_KEY) return null;
    try {
      const client = createClient(SUPABASE_URL, ANON_KEY);
      const { data, error } = await client.auth.getUser(token);
      if (error || !data.user) return null;
      return data.user.id;
    } catch { return null; }
  },
  verifySchoolQuote: async (url, quote) => {
    if (!isPublicHttp(url)) return false;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) return false;
      const html = await res.text();
      return pageText(html).includes(quote);
    } catch { return false; }
  },
  insert: async (rows) => {
    if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("Service role key not configured");
    // Service role bypasses RLS; db/003-policy-gaps-server-only.sql drops the open client-insert policy,
    // so this route is the only writer left.
    const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
    const { error } = await admin.from("policy_gaps").upsert(rows, { onConflict: "school,topic,syllabus_hash", ignoreDuplicates: true });
    if (error) throw error;
  },
});
