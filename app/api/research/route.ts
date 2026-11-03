import { createClient } from "@supabase/supabase-js";
import { createResearchHandlers } from "@/lib/research/handler";
import { queryLocalResearch } from "@/lib/research/local";
import { verifyResearchOwner } from "@/lib/research/owner";
import { connection } from "next/server";

const handlers = createResearchHandlers({
  owner: async (token) => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    try {
      const client = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      // Existing RPC checks app_owners against auth.uid() in the database.
      // User-editable profile metadata never grants research access.
      return await verifyResearchOwner(token, client);
    } catch {
      console.error("[research] Owner access could not be verified.");
      return null;
    }
  },
  query: queryLocalResearch,
});

export async function GET(request: Request) {
  // Private authorization/storage must only run for an actual request, never prerender.
  await connection();
  return handlers.GET(request);
}
export const POST = handlers.POST;
