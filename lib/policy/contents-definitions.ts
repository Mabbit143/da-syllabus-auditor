import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ContentsGroup } from "./contents-types";

const FILE = "002-provost-syllabus-requirement-undergraduate-and-graduate-policy.md";
const GROUPS = [
  { id: "instructor", label: "Instructor information", anchor: "INSTRUCTOR INFORMATION:", components: [["instructor_name", "Instructor name"], ["office_room", "Office or room"], ["uo_email", "UO email address"]] },
  { id: "office", label: "Office hours", anchor: "OFFICE HOURS:", components: [["office_hours", "Scheduled office hours"], ["office_appointment", "Appointments outside office hours"]] },
  { id: "objectives", label: "Course objectives", anchor: "COURSE OBJECTIVES:", components: [["objectives", "Course objectives"], ["learning_outcomes", "Learning outcomes"], ["core_education", "Applicable Core Education statements and outcomes"]] },
  { id: "grading", label: "Grading", anchor: "GRADE POLICIES:", components: [["grade_standards", "Standards for grades"], ["grade_criteria", "Grading criteria and expectations"]] },
  { id: "absences", label: "Absences", anchor: "ABSENCES:", components: [["absence_policy", "Attendance or engagement expectations and policy"]] },
  { id: "materials", label: "Materials and activities", anchor: "MATERIALS AND ACTIVITIES:", components: [["materials", "Required readings and materials, if used"], ["activities", "Assignments, exams and activities, if used"]] },
  { id: "behavior", label: "Classroom behavior", anchor: "CLASSROOM BEHAVIOR:", components: [["behavior", "Classroom behavior expectations"]] },
  { id: "university", label: "University policies and accommodations", anchor: "UNIVERSITY POLICIES AND COURSE ACCOMODATIONS:", components: [["university_statement", "Required university policies and accommodations statement"]] },
] as const;

/** Return only requirements whose exact source wording is available in the snapshot. */
export async function contentsDefinitions(level: "undergraduate" | "graduate" | "unknown"): Promise<ContentsGroup[]> {
  const root = path.join(process.cwd(), "data/uo-policies");
  const [text, guidance] = await Promise.all([
    readFile(path.join(root, FILE), "utf8"),
    readFile(path.join(root, "006-teaching-syllabus.md"), "utf8"),
  ]);
  if (!guidance.includes("As of Fall 2026, the following statement is required to be in all course syllabi.")) throw new Error("Statement applicability source unavailable");
  const url = /^Source: (https:\/\/\S+)\s*$/m.exec(text)?.[1];
  if (!url || new URL(url).hostname !== "provost.uoregon.edu" || !text.includes("Fetched: 2026-10-27")) throw new Error("Requirement source unavailable");
  const body = level === "graduate"
    ? text.slice(text.indexOf("Graduate Courses"), text.indexOf("Undergraduate syllabus policy"))
    : text.slice(text.indexOf("Undergraduate Courses"), text.indexOf("Graduate Courses"));
  const locate = (anchor: string, from = 0) => {
    // Graduate headings sometimes add a space before the colon; preserve source text.
    const pattern = new RegExp(anchor.replace(":", "\\s*:"), "g");
    pattern.lastIndex = from;
    return pattern.exec(body)?.index ?? -1;
  };
  return GROUPS.map((group, index) => {
    const start = locate(group.anchor);
    const next = GROUPS[index + 1];
    const end = next ? locate(next.anchor, start) : body.indexOf("\nThe remaining policy statements", start);
    const quote = body.slice(start, end).trim();
    if (start < 0 || end <= start || !text.includes(quote)) throw new Error(`Requirement unavailable: ${group.id}`);
    const standardText = group.id === "university" ? quote.slice(quote.indexOf('"') + 1, quote.lastIndexOf('"')).trim() : undefined;
    return {
      id: group.id, label: group.label,
      components: group.components.map(([id, label]) => ({
        id, label, status: "not_assessed", applicability: "unknown", passages: [],
        policyQuote: quote, policyUrl: url,
        question: `Where can I find the course information about ${label.toLowerCase()}?`,
        ...(standardText ? { standardText } : {}),
      })),
    };
  });
}
