export const POLICY_TOPICS = ["accommodations", "late_work", "attendance", "academic_integrity", "incompletes"] as const;
export type PolicyTopic = (typeof POLICY_TOPICS)[number];

export const TOPIC_LABEL: Record<PolicyTopic, string> = {
  accommodations: "Disability accommodations",
  late_work: "Late work and extensions",
  attendance: "Attendance",
  academic_integrity: "Academic integrity",
  incompletes: "Incompletes",
};

// What to search for, per topic.
export const TOPIC_SEARCH: Record<PolicyTopic, string> = {
  accommodations: "how students with disabilities request academic accommodations",
  late_work: "late work, missed assignments and extensions for students",
  attendance: "class attendance requirements and absences",
  academic_integrity: "academic integrity and cheating or plagiarism",
  incompletes: "grades of incomplete",
};

// Code, not the model, decides a syllabus is silent: none of these words may appear in it.
export const TOPIC_WORDS: Record<PolicyTopic, RegExp> = {
  accommodations: /accommodat|disabilit|accessib/i,
  late_work: /\blate\b|extension|make-?up|missed (work|assignment|exam)/i,
  attendance: /attendance|absen|\battend/i,
  academic_integrity: /integrity|plagiari|cheat|misconduct|honor code|honesty/i,
  incompletes: /incomplete/i,
};

/** A school rule, with the exact words and the page they came from. */
export interface SchoolPolicy {
  topic: PolicyTopic;
  url: string;
  quote: string;
}

export type Relation = "matches" | "conflicts" | "adds_requirement" | "silent";

export interface PolicyComparison {
  topic: PolicyTopic;
  relation: Relation;
  syllabusPage?: number;
  syllabusQuote?: string;
  schoolQuote: string;
  schoolUrl: string;
  instructor: string | null;
}

export interface PolicyCheck {
  school: string;
  checkedAt: string;
  items: PolicyComparison[];
}
