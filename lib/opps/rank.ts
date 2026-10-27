import { schoolMatches } from "./fit";
import type { Opportunity, Profile, RankedOpportunity } from "./types";

const DAY = 86_400_000;

/**
 * Deterministic ranking. The model never ranks. Order:
 * 1. hard filters (deadline passed, requirements the profile lacks, major mismatch) remove a listing,
 * 2. listings due in a crunch week sink,
 * 3. higher expected value first: the dollar amount, weighted up 25% for each way the award targets this
 *    student (a profile flag other than study level, a major, or their school), since targeted awards
 *    draw smaller applicant pools. A missing amount counts as $0, not as a reason to hide the listing,
 * 4. sooner deadline breaks ties.
 */
const TARGET_WEIGHT = 0.25;

function targeting(o: Opportunity): number {
  return (
    o.requires.filter((r) => r !== "undergrad" && r !== "grad").length +
    (o.majors.length > 0 ? 1 : 0) +
    ((o.schools ?? []).length > 0 ? 1 : 0)
  );
}

export function expectedValue(o: Opportunity): number {
  return (o.amount ?? 0) * (1 + TARGET_WEIGHT * targeting(o));
}

export function rankOpportunities(
  opps: Opportunity[],
  profile: Profile,
  crunchWeeks: number[],
  now: Date = new Date(),
): RankedOpportunity[] {
  const kept: RankedOpportunity[] = [];
  for (const o of opps) {
    const why: string[] = [];
    if (o.requires.some((r) => !profile.flags.includes(r))) continue;
    if (o.requires.length) why.push(`Matches your profile: ${o.requires.join(", ").replace(/_/g, " ")}`);
    const limitedTo = o.schools ?? [];
    if (limitedTo.length) {
      if (!schoolMatches(limitedTo, profile.school)) continue;
      why.push(`Limited to students at ${profile.school}`);
    }
    if (o.majors.length) {
      const m = profile.major.trim().toLowerCase();
      if (!m || !o.majors.some((x) => x.toLowerCase().includes(m) || m.includes(x.toLowerCase()))) continue;
      why.push(`Open to your major (${profile.major})`);
    }

    let daysLeft: number | null = null;
    if (o.deadline) {
      daysLeft = Math.ceil((new Date(o.deadline + "T23:59:59").getTime() - now.getTime()) / DAY);
      if (daysLeft < 0) continue;
    }

    let crunchWeek: number | null = null;
    if (o.deadline && profile.termStart) {
      const week = Math.floor((new Date(o.deadline).getTime() - new Date(profile.termStart).getTime()) / (7 * DAY)) + 1;
      if (crunchWeeks.includes(week)) crunchWeek = week;
    }

    if (o.amount !== null) {
      const t = targeting(o);
      why.push(t > 0 ? `Worth $${o.amount.toLocaleString("en-US")}, weighted up for targeting you` : `Worth $${o.amount.toLocaleString("en-US")}`);
    }
    if (daysLeft !== null) why.push(daysLeft <= 14 ? `Due soon: ${daysLeft} days left` : `${daysLeft} days left`);
    if (crunchWeek !== null) why.push(`Deadline lands in week ${crunchWeek}, one of your crunch weeks`);
    kept.push({ ...o, rank: 0, why, daysLeft, crunchWeek });
  }

  kept.sort(
    (a, b) =>
      Number(a.crunchWeek !== null) - Number(b.crunchWeek !== null) ||
      expectedValue(b) - expectedValue(a) ||
      (a.daysLeft ?? 9e9) - (b.daysLeft ?? 9e9),
  );
  kept.forEach((o, i) => (o.rank = i + 1));
  return kept;
}
