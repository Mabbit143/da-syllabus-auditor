import type { Coverage, Passage } from "../types";

export interface CourseContext {
  term: "winter" | "spring" | "summer" | "fall" | "unknown";
  year: number | null;
  level: "undergraduate" | "graduate" | "unknown";
  coreEducation: "yes" | "no" | "unknown";
}
export const UNKNOWN_CONTEXT: CourseContext = { term: "unknown", year: null, level: "unknown", coreEducation: "unknown" };
export type ContentsStatus = "found" | "needs_review" | "not_assessed" | "not_applicable";
export type Applicability = "current_snapshot" | "historical_unverified" | "unknown" | "not_applicable";
export interface ContentsComponent {
  id: string;
  label: string;
  status: ContentsStatus;
  applicability: Applicability;
  passages: Passage[];
  policyQuote: string;
  policyUrl: string;
  question: string;
  standardText?: string;
}
export interface ContentsGroup {
  id: string;
  label: string;
  components: ContentsComponent[];
}
export interface RequiredContents {
  context: CourseContext;
  snapshotDate: string;
  groups: ContentsGroup[];
  coverage: Coverage;
  error?: string;
}
