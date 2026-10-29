import { readFile } from "node:fs/promises";
import path from "node:path";
import type { PolicyTopic, SchoolPolicy } from "./types";
import { loadReviewedPolicies } from "./reviewed-ocr";

// Reviewed topic locators, rather than keyword hits in navigation or meeting agendas.
const SOURCES: Record<PolicyTopic, { file: string; start: string; end?: string }> = {
  accommodations: {
    file: "050-teaching-university-course-policies.md",
    start: "The Accessible Education Center (AEC) assists",
  },
  late_work: {
    file: "003-provost-undergraduate-course-attendance-and-engagement-policy.md",
    start: "Every course syllabus shall outline how to handle work",
  },
  attendance: {
    file: "003-provost-undergraduate-course-attendance-and-engagement-policy.md",
    start: "Except for the legitimate and verifiable reasons",
    end: "Except for the documentation referenced in 3 and 4, instructors shall not ask students for documentation for absences.",
  },
  academic_integrity: {
    file: "050-teaching-university-course-policies.md",
    start: "The University Student Conduct Code (available",
    end: "If an instructor suspects that a student has engaged in academic misconduct, know they are required to contact the Office of Student Conduct and Community Standards.",
  },
  incompletes: {
    file: "034-provost-grades-incompletes-policy.md",
    start: 'A grade of "I" (Incomplete) represents',
    end: "requests an Incomplete by the published deadline",
  },
  final_exams: {
    file: "032-provost-final-exams-policy.md",
    start: "Final examinations must be given",
    end: "prohibits the early administration of final examinations.",
  },
  dead_week: {
    file: "031-provost-dead-week.md",
    start: "In the week preceding final examinations",
    end: "the day of the formally assigned final examination for the class in question.",
  },
  religious_observance: {
    file: "045-provost-religious-observance-accommodations-policy.md",
    start: "The University of Oregon makes reasonable accommodations, upon request",
    end: "providing an opportunity to make up coursework.",
  },
  grievances: {
    file: "048-provost-student-grievance-policy.md",
    start: "Before filing a formal grievance",
  },
  mandatory_reporting: {
    file: "050-teaching-university-course-policies.md",
    start: "All instructors are designated reporters",
  },
  withdrawal: {
    file: "177-registrar-registration-register-classes-adddrop-courses.md",
    start: "Students can drop or withdraw from a course in MyUO through the withdrawal deadline each term.",
    end: "impact your refund for the course throughout the term.",
  },
};

export function usesUoCorpus(school: string): boolean {
  return school.trim().replace(/\s+/g, " ").toLowerCase() === "university of oregon";
}

/** Verify against the committed snapshot, not a claim that the live page is unchanged. */
export async function corpusPolicies(topics: readonly PolicyTopic[]): Promise<SchoolPolicy[]> {
  const reviewed = await loadReviewedPolicies(topics);
  const policies = await Promise.all(topics.map(async (topic) => {
    try {
      const replacement = reviewed.find((policy) => policy.topic === topic);
      if (replacement) return replacement;
      const source = SOURCES[topic];
      const text = await readFile(path.join(process.cwd(), "data/uo-policies", source.file), "utf8");
      const url = /^Source: (https:\/\/\S+)\s*$/m.exec(text)?.[1];
      if (!url) throw new Error("Missing source URL");
      const host = new URL(url).hostname;
      if (host !== "uoregon.edu" && !host.endsWith(".uoregon.edu")) throw new Error("Source is outside UO");
      const bodyStart = text.indexOf("\n\n", text.indexOf("Found from:"));
      const start = text.indexOf(source.start, bodyStart);
      if (bodyStart < 0 || start < bodyStart || text.indexOf(source.start, start + 1) !== -1) throw new Error("Missing or ambiguous passage");
      const endStart = source.end ? text.indexOf(source.end, start) : text.indexOf("\n", start);
      if (endStart < start) throw new Error("Missing passage ending");
      const end = source.end ? endStart + source.end.length : endStart;
      const quote = text.slice(start, end).trim();
      if (quote.length < 40 || !text.slice(bodyStart).includes(quote)) throw new Error("Passage did not verify");
      return { topic, url, quote } satisfies SchoolPolicy;
    } catch (err) {
      console.error(`[policy] corpus ${topic} unavailable:`, err instanceof Error ? err.message : "read failed");
      return null;
    }
  }));
  return policies.filter((policy): policy is SchoolPolicy => policy !== null);
}
