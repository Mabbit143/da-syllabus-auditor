import { DIMENSIONS } from "./rubric";
import type { Dimension, DimensionStatus } from "./types";
import type { Course } from "../components/TermView";

/** Leading letters immediately followed by a course number, e.g. "ANTH145..." -> "ANTH". Null if no match. */
export function departmentCodeOf(fileName: string): string | null {
  const m = /^([A-Za-z]{2,5})[\s_-]?\d{2,4}/.exec(fileName.trim());
  return m ? m[1].toUpperCase() : null;
}

export interface DimensionTally {
  strong: number;
  weak: number;
  mixed: number;
  notAssessed: number;
  notFound: number;
  /** The characterization word shared by a strict majority of this dimension's strong/weak courses; null on a tie or no signal. */
  dominant: string | null;
}

export interface DepartmentRollup {
  code: string;
  courses: Course[];
  dimensions: Record<Dimension, DimensionTally>;
}

function tally(courses: Course[], dimension: Dimension): DimensionTally {
  const statuses = courses.map((c) => c.report.dimensions.find((d) => d.dimension === dimension));
  const counts: Record<DimensionStatus, number> = { strong: 0, weak: 0, mixed: 0, not_found: 0, not_assessed: 0 };
  const words = new Map<string, number>();
  for (const d of statuses) {
    if (!d) continue;
    counts[d.status] += 1;
    if (d.characterization) words.set(d.characterization, (words.get(d.characterization) ?? 0) + 1);
  }
  let dominant: string | null = null;
  let max = 0;
  for (const [word, n] of words) {
    if (n > max) { dominant = word; max = n; }
    else if (n === max) dominant = null; // tie: say nothing rather than guess
  }
  const total = [...words.values()].reduce((a, b) => a + b, 0);
  if (total === 0 || max * 2 <= total) dominant = null; // require a strict majority, not just a plurality
  return { strong: counts.strong, weak: counts.weak, mixed: counts.mixed, notAssessed: counts.not_assessed, notFound: counts.not_found, dominant };
}

export function rollupByDepartment(courses: Course[]): DepartmentRollup[] {
  const groups = new Map<string, Course[]>();
  for (const c of courses) {
    const code = departmentCodeOf(c.report.fileName);
    if (!code) continue;
    groups.set(code, [...(groups.get(code) ?? []), c]);
  }
  return [...groups.entries()]
    .map(([code, group]) => ({
      code,
      courses: group,
      dimensions: Object.fromEntries(DIMENSIONS.map(({ id }) => [id, tally(group, id)])) as Record<Dimension, DimensionTally>,
    }))
    .sort((a, b) => b.courses.length - a.courses.length || a.code.localeCompare(b.code));
}
