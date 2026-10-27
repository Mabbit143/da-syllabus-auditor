import { NextResponse } from "next/server";
import { callMeta, callMetaSearch } from "@/lib/meta";
import { discoverFunding } from "@/lib/opps/discover";
import { rankOpportunities } from "@/lib/opps/rank";
import { REQUIREMENT_FLAGS, type Profile, type RequirementFlag } from "@/lib/opps/types";

export const maxDuration = 300;

function fail(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function readProfile(body: unknown): Profile | null {
  const b = (body as { profile?: Partial<Profile> } | null)?.profile;
  if (!b || typeof b !== "object") return null;
  const str = (v: unknown) => (typeof v === "string" ? v.slice(0, 100) : "");
  return {
    major: str(b.major), school: str(b.school), location: str(b.location),
    hoursPerWeek: Number.isFinite(Number(b.hoursPerWeek)) ? Math.max(0, Math.min(80, Number(b.hoursPerWeek))) : 0,
    flags: (Array.isArray(b.flags) ? b.flags : []).filter((f): f is RequirementFlag => (REQUIREMENT_FLAGS as readonly string[]).includes(f as string)),
    termStart: typeof b.termStart === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.termStart) ? b.termStart : null,
  };
}

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return fail(400, "bad_json", "Request was not valid JSON.");
    }
    const profile = readProfile(body);
    if (!profile) return fail(400, "invalid_request", "A profile is required.");
    const crunchWeeks = Array.isArray((body as { crunchWeeks?: unknown }).crunchWeeks)
      ? ((body as { crunchWeeks: unknown[] }).crunchWeeks.filter((n) => Number.isInteger(n)) as number[])
      : [];

    const { found, dropped, queries } = await discoverFunding(profile, callMetaSearch, callMeta);
    return NextResponse.json({ opportunities: rankOpportunities(found, profile, crunchWeeks), dropped, searches: queries });
  } catch (err) {
    console.error("[api/opportunities] failed:", err instanceof Error ? err.message : err);
    return fail(500, "discovery_failed", "The search could not be completed. Please try again.");
  }
}
