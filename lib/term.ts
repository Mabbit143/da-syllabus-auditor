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

export function termLabel(id: string): string {
  const { year, season } = parseTermId(id);
  return `${SEASON_LABEL[season]} ${year}`;
}
