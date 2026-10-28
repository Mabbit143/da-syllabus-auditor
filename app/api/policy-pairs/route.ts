import { callMeta } from "@/lib/meta";
import { findPairDifferences } from "@/lib/policy/pairs";
import { POLICY_PAIRS } from "@/lib/policy/pairs-types";

export const maxDuration = 300;

const fail = (status: number, message: string) => Response.json({ error: { message } }, { status });

export async function POST(request: Request): Promise<Response> {
  try {
    const body: unknown = await request.json().catch(() => null);
    const id = body && typeof body === "object" ? (body as { id?: unknown }).id : undefined;
    if (typeof id !== "string" || !POLICY_PAIRS.some((p) => p.id === id)) return fail(400, "Choose a listed pair of documents.");
    return Response.json(await findPairDifferences(id, callMeta));
  } catch (err) {
    console.error("[pairs] failed:", err instanceof Error ? err.message : err);
    return fail(502, "The comparison could not be completed. Please try again.");
  }
}
