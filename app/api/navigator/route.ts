import { callBaseten, callMeta, isBaseten } from "@/lib/meta";
import { findOffices } from "@/lib/policy/navigator";
import { SITUATIONS } from "@/lib/policy/navigator-types";

export const maxDuration = 300;

const fail = (status: number, message: string) => Response.json({ error: { message } }, { status });

export async function POST(request: Request): Promise<Response> {
  try {
    const body: unknown = await request.json().catch(() => null);
    const id = body && typeof body === "object" ? (body as { id?: unknown }).id : undefined;
    if (typeof id !== "string" || !SITUATIONS.some((s) => s.id === id)) return fail(400, "Choose one of the listed situations.");
    // With both providers configured, a second model reads the same pages; an office only one named is marked.
    const second = !isBaseten() && process.env.BASETEN_API_KEY ? callBaseten : undefined;
    return Response.json(await findOffices(id, callMeta, second));
  } catch (err) {
    console.error("[navigator] failed:", err instanceof Error ? err.message : err);
    return fail(502, "The offices could not be looked up. Please try again.");
  }
}
