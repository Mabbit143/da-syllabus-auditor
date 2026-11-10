import { createClient } from "@supabase/supabase-js";

// Tiny read so Supabase sees database activity and doesn't auto-pause the free project.
// Pinged weekly by .github/workflows/supabase-keepalive.yml.

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return Response.json({ ok: false, error: "supabase env missing" }, { status: 500 });
  try {
    const client = createClient(url, key, { auth: { persistSession: false } });
    const { error } = await client.from("policy_gaps").select("school", { head: true, count: "exact" }).limit(1);
    if (error) return Response.json({ ok: false, error: error.message }, { status: 502 });
    return Response.json({ ok: true, at: new Date().toISOString() });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 502 });
  }
}
