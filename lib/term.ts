// Approximate UO-style quarter boundaries, used only to group saved audits by term for
// term-to-term comparison. These are fixed calendar cutoffs, not the real academic calendar
// (which shifts slightly every year) — close enough for grouping, not for scheduling.
export type TermSeason = "winter" | "spring" | "summer" | "fall";

export interface Term {
  id: string; // e.g. "2026-fall"
  label: string; // e.g. "Fall 2026"
}

const SEASON_LABEL: Record<TermSeason, string> = { winter: "Winter", spring: "Spring", summer: "Summer", fall: "Fall" };
const SEASON_ORDER: TermSeason[] = ["winter", "spring", "summer", "fall"];

function seasonOf(date: Date): TermSeason {
  const month = date.getMonth() + 1; // 1-12
  const day = date.getDate();
  const md = month * 100 + day;
  if (md <= 320) return "winter"; // Jan 1 - Mar 20
  if (md <= 614) return "spring"; // Mar 21 - Jun 14
  if (md <= 920) return "summer"; // Jun 15 - Sep 20
  return "fall"; // Sep 21 - Dec 31
}

export function termOf(date: Date): Term {
  const season = seasonOf(date);
  const year = date.getFullYear();
  return { id: `${year}-${season}`, label: `${SEASON_LABEL[season]} ${year}` };
}

function parseTermId(id: string): { year: number; season: TermSeason } {
  const [yearStr, season] = id.split("-");
  const year = Number(yearStr);
  if (!Number.isInteger(year) || !SEASON_ORDER.includes(season as TermSeason)) throw new Error(`Invalid term id: ${id}`);
  return { year, season: season as TermSeason };
}

export function previousTermId(id: string): string {
  const { year, season } = parseTermId(id);
  const index = SEASON_ORDER.indexOf(season);
  if (index === 0) return `${year - 1}-${SEASON_ORDER[SEASON_ORDER.length - 1]}`;
  return `${year}-${SEASON_ORDER[index - 1]}`;
}


export function inferTermId(input: { fileName?: string; text?: string }): string | null {
  const hay = `${input.fileName ?? ""} ${input.text ?? ""}`;
  // 1) Long form: Spring 2025, Fall 2026, etc.
  const long = hay.match(/\b(winter|spring|summer|fall)\s+20(\d{2})\b/i);
  if (long) {
    const season = long[1].toLowerCase() as TermSeason;
    const year = 2000 + Number(long[2]);
    if (SEASON_ORDER.includes(season)) return `${year}-${season}`;
  }
  // 2) Filename shorthands like W26, S26, F25, Sp26 etc. (e.g. ANTH 270 W26)
  const file = input.fileName ?? "";
  // Normalize: first letter determines season, 2-digit year
  const m = file.match(/\b([WSF])\s*0*([0-9]{2})\b/i);
  if (m) {
    const letter = m[1].toLowerCase();
    const yy = Number(m[2]);
    const year = yy < 50 ? 2000 + yy : 1900 + yy;
    const map: Record<string, TermSeason> = { w: "winter", s: "spring", f: "fall" };
    // Summer rarely uses single letter; treat S as spring to match user's files (Spring/Winter/Fall only observed)
    const season = map[letter];
    if (season) return `${year}-${season}`;
  }
  // 3) Check for 'Spring 25' style with 2-digit year
  const spring2 = hay.match(/\b(winter|spring|summer|fall)\s+'?(\d{2})\b/i);
  if (spring2) {
    const season = spring2[1].toLowerCase() as TermSeason;
    const year = 2000 + Number(spring2[2]);
    if (SEASON_ORDER.includes(season)) return `${year}-${season}`;
  }
  return null;
}

/** The upload page's term picker (`"2025-fall"`) → term + year, matching the required-contents form's prefill. */
export function contextFromTermId(id: string | null | undefined): { term: TermSeason; year: number } | null {
  if (!id) return null;
  const { year, season } = parseTermId(id);
  return { term: season, year };
}

export function termLabel(id: string): string {
  const { year, season } = parseTermId(id);
  return `${SEASON_LABEL[season]} ${year}`;
}
