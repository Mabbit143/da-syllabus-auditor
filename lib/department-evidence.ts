import topicRegistry from "../data/evidence-topics.json" with { type: "json" };
import { rollupByDepartment, type DepartmentRollup } from "./departments";
import type { Course } from "../components/TermView";
import type { EvidenceRecord } from "./policy/evidence";

// Only explicitly registered department topics have a scope. Never infer a scope
// from a topic's label, a quote, a URL, or an unfamiliar topic-id prefix.
const DEPARTMENT_SCOPES: Record<string, { code: string; school: string }> = {
  dept_uo_anthropology: { code: "ANTH", school: "University of Oregon" },
};
const schoolKey = (school: string) => school.trim().toLowerCase().replace(/\s+/g, " ");

/** Unknown or mixed-school rollups cannot claim a department's published words. */
export function evidenceForDepartment(
  evidence: EvidenceRecord[],
  department: DepartmentRollup,
  school?: string | null,
): EvidenceRecord[] {
  if (department.courses.length === 0) return [];
  return evidence.filter((record) => {
    if (!topicRegistry.topics.some((topic) => topic.id === record.topic.id)) return false;
    const scope = DEPARTMENT_SCOPES[record.topic.id];
    if (!scope || scope.code !== department.code) return false;
    return department.courses.every((course) => {
      // A saved report's explicit school takes precedence over the account default.
      const courseSchool = course.report.policyCheck?.school?.trim() || school?.trim();
      return !!courseSchool && schoolKey(courseSchool) === schoolKey(scope.school);
    });
  });
}

/** The packet route reselects the submitted quotation from verified, scoped records. */
export function packetEvidenceForCourses(
  evidence: EvidenceRecord[],
  courses: Course[],
  candidate: unknown,
  school?: string | null,
): EvidenceRecord | null {
  if (!candidate || typeof candidate !== "object") return null;
  const groups = rollupByDepartment(courses);
  if (groups.length !== 1 || groups[0].courses.length !== courses.length) return null;
  const submitted = candidate as Record<string, unknown>;
  return evidenceForDepartment(evidence, groups[0], school).find((record) =>
    record.quote === submitted.quote && record.sourceUrl === submitted.sourceUrl && record.page === submitted.page,
  ) ?? null;
}
