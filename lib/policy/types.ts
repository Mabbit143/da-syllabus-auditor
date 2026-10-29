export const POLICY_TOPICS = ["accommodations", "late_work", "attendance", "academic_integrity", "incompletes", "final_exams", "dead_week", "religious_observance", "grievances", "mandatory_reporting"] as const;
export type PolicyTopic = (typeof POLICY_TOPICS)[number];

export const TOPIC_LABEL: Record<PolicyTopic, string> = {
  accommodations: "Disability accommodations",
  late_work: "Late work and extensions",
  attendance: "Attendance",
  academic_integrity: "Academic integrity",
  incompletes: "Incompletes",
  final_exams: "Final exams",
  dead_week: "Dead week",
  religious_observance: "Religious observance",
  grievances: "Complaints and grievances",
  mandatory_reporting: "Instructors as mandatory reporters",
};

// Plain meaning of each topic, for a student who has never read a syllabus policy.
export const TOPIC_PLAIN: Record<PolicyTopic, string> = {
  accommodations: "Changes that remove barriers for students with disabilities, arranged through the school's disability office.",
  late_work: "Whether and how work turned in after the deadline is accepted.",
  attendance: "Whether attendance counts toward your grade, and what happens when you miss class.",
  academic_integrity: "Rules against cheating, plagiarism and unauthorized help.",
  incompletes: "An Incomplete is a temporary grade that can give you more time to finish coursework after the term ends, in some situations.",
  final_exams: "When final exams may be given, and what happens if you have several at once.",
  dead_week: "The last week before finals, when big exams and surprise projects are limited.",
  religious_observance: "How to ask for time off or schedule changes for a religious observance.",
  grievances: "How to file a formal complaint about a decision or treatment at the school, and who can help first.",
  mandatory_reporting: "What instructors are required to report, so you know what is confidential when you tell them something.",
};

// What to search for, per topic.
export const TOPIC_SEARCH: Record<PolicyTopic, string> = {
  accommodations: "how students with disabilities request academic accommodations",
  late_work: "late work, missed assignments and extensions for students",
  attendance: "class attendance requirements and absences",
  academic_integrity: "academic integrity and cheating or plagiarism",
  incompletes: "grades of incomplete",
  final_exams: "final examination scheduling policy",
  dead_week: "dead week limits on exams and projects",
  religious_observance: "religious observance accommodations for students",
  grievances: "student grievance policy and informal resolution",
  mandatory_reporting: "instructors as designated or mandatory reporters",
};

// Code, not the model, decides a syllabus is silent: none of these words may appear in it.
export const TOPIC_WORDS: Record<PolicyTopic, RegExp> = {
  accommodations: /accommodat|disabilit|accessib/i,
  late_work: /\blate\b|extension|make-?up|missed (work|assignment|exam)/i,
  attendance: /attendance|absen|\battend/i,
  academic_integrity: /integrity|plagiari|cheat|misconduct|honor code|honesty/i,
  incompletes: /incomplete/i,
  final_exams: /final exam|\bfinals\b|exam period/i,
  dead_week: /dead week|week (before|preceding) (final|exam)/i,
  religious_observance: /religious (observance|holiday|accommodation|obligation)|holy ?day|observance/i,
  grievances: /grievance|complaint|appeal|dispute/i,
  mandatory_reporting: /mandatory report|designated reporter|required to report|title ix/i,
};

/** A school rule, with the exact words and the page they came from. */
export interface SchoolPolicy {
  provenance?: PolicyProvenance;
  topic: PolicyTopic;
  url: string;
  quote: string;
}

export type Relation = "matches" | "conflicts" | "adds_requirement" | "silent" | "disputed";

export interface PolicyComparison {
  schoolProvenance?: PolicyProvenance;
  topic: PolicyTopic;
  relation: Relation;
  syllabusPage?: number;
  syllabusQuote?: string;
  schoolQuote: string;
  schoolUrl: string;
  instructor: string | null;
}

export interface PolicyProvenance {
  method: "reviewed_ocr";
  extractionMethod: "text" | "ocr";
  page: number;
  region: [number, number, number, number];
  sourcePdfSha256: string;
  artifactSha256: string;
  imageSha256: string;
  reviewedAt: string;
}

export interface PolicyCheck {
  comparisonStatus?: "complete" | "not_run";
  requiredContents?: import("./contents-types").RequiredContents;
  school: string;
  checkedAt: string;
  items: PolicyComparison[];
}
