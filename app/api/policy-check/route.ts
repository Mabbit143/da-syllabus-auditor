import { NextResponse } from "next/server";
import { callMeta, callMetaSearch } from "@/lib/meta";
import { comparePolicies } from "@/lib/policy/compare";
import { lookupPolicies, recheckPolicies } from "@/lib/policy/lookup";
import { POLICY_TOPICS, type SchoolPolicy } from "@/lib/policy/types";

export const maxDuration = 300;

function fail(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(request: Request) {
  try {
    let body: { school?: unknown; pages?: unknown; saved?: unknown };
    try {
      body = await request.json();
    } catch {
      return fail(400, "bad_json", "Request was not valid JSON.");
    }
    const school = typeof body.school === "string" ? body.school.trim().slice(0, 100) : "";
    if (school.length < 3) return fail(400, "invalid_request", "A school name is required.");
    const pages = body.pages;
    if (!Array.isArray(pages) || pages.length === 0 || pages.length > 80 || !pages.every((p) => p && Number.isInteger(p.pageNumber) && typeof p.text === "string" && p.text.length <= 20_000)) {
      return fail(400, "invalid_request", "pages are required.");
    }
    const saved = (Array.isArray(body.saved) ? body.saved : [])
      .filter((p): p is SchoolPolicy => !!p && typeof p.url === "string" && typeof p.quote === "string" && (POLICY_TOPICS as readonly string[]).includes(p.topic))
      .slice(0, POLICY_TOPICS.length);

    // Saved policies are fetched and checked again; only the missing ones are searched for.
    const policies = await recheckPolicies(school, saved);
    const missing = POLICY_TOPICS.filter((t) => !policies.some((p) => p.topic === t));
    const looked = await lookupPolicies(school, missing, callMetaSearch, callMeta);
    const all = [...policies, ...looked];

    const items = await comparePolicies(pages, all, callMeta);
    return NextResponse.json({ policies: all, items, newPolicies: looked.length > 0 || policies.length !== saved.length });
  } catch (err) {
    console.error("[api/policy-check] failed:", err instanceof Error ? err.message : err);
    return fail(500, "policy_check_failed", "The policy check could not be completed. Please try again.");
  }
}
