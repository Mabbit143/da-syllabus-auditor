import { supabase } from "../supabase";

export async function researchRequest<T>(url = "/api/research", options: RequestInit = {}): Promise<T> {
  try {
    const client = supabase();
    const { data } = client ? await client.auth.getSession() : { data: { session: null } };
    const token = data.session?.access_token;
    if (!token) throw new Error("Sign in to view private research.");
    const response = await fetch(url, { ...options, cache: "no-store", headers: { "Content-Type": "application/json", ...options.headers, Authorization: `Bearer ${token}` } });
    const body = await response.json();
    if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Research could not be loaded.");
    return body as T;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    console.error("[research] Research request could not be completed.");
    throw error instanceof Error ? error : new Error("Research could not be loaded. Please try again.");
  }
}
