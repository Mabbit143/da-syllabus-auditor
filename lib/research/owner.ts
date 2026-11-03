interface OwnerClient {
  auth: { getUser: (token: string) => Promise<{ data: { user: { id: string } | null }; error: unknown }> };
  rpc: (name: string, args: { threshold: number }) => PromiseLike<{ data: unknown; error: unknown }>;
}

/** Authorize against the database membership check, never profile metadata. */
export async function verifyResearchOwner(token: string, client: OwnerClient): Promise<string | null> {
  try {
    const { data: auth, error: authError } = await client.auth.getUser(token);
    if (authError || !auth.user) return null;
    const { data, error } = await client.rpc("gap_report", { threshold: 5 });
    return !error && Array.isArray(data) ? auth.user.id : null;
  } catch {
    console.error("[research] Owner access could not be verified.");
    return null;
  }
}
