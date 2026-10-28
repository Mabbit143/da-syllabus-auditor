import type { PolicyCheck } from "./policy/types";

export type Dimension ="transparency" | "punitive" | "accessibility" | "perspectives" | "hidden";

export type DimensionStatus = "strong" | "weak" | "mixed" | "not_found" | "not_assessed";

export type Severity = "high" | "medium";

export type FlagKind = "attendance" | "weight" | "late";

export interface Page {
  pageNumber: number;
  text: string;
}

export interface Passage {
  id: string;
  page: number;
  start: number;
  end: number;
  text: string;
}

export interface SignalHit {
  code: string;
  label: string;
  polarity: 1 | -1;
  passageId: string;
  evidence?: AuthorEvidence;
  pairedPassageId?: string;
}

export interface AuthorEvidence {
  author: string;
  url: string;
  quote: string;
}

export interface DimensionResult {
  dimension: Dimension;
  title: string;
  status: DimensionStatus;
  positive: number;
  negative: number;
  hits: SignalHit[];
  /** Plain statements about text that is present but did not count, such as a statement naming no route. */
  notes?: string[];
}

export interface FlagResult {
  kind: FlagKind;
  severity: Severity;
  explanation: string;
  passageId: string;
  /** Set when a finding rests on several passages, such as grade weights that do not add up. */
  passageIds?: string[];
}

export interface Overall {
  label: "old-guard leaning" | "mixed" | "inclusive leaning" | null;
  reason: string;
  included: number;
  score: number;
}

export interface Coverage {
  status: "full" | "partial";
  skipped: string[];
}

export interface Assessment {
  what: string;
  week: number;
  percent: number | null;
  passageId: string;
}

export interface AuditReport {
  policyCheck?: PolicyCheck;
  assessments: Assessment[];
  fileName: string;
  pageCount: number;
  coverage: Coverage;
  dimensions: DimensionResult[];
  flags: FlagResult[];
  biggestRiskIndex: number | null;
  overall: Overall;
  passages: Passage[];
}

export interface AuditRequest {
  requestId: string;
  fileName: string;
  pageCount: number;
  pages: Page[];
}

export interface Candidates {
  assessments: { what: string; week: number; percent: number | null; page: number; quote: string }[];
  readings: { author: string; title: string; topic?: string; page: number; quote: string }[];
  signals: { code: string; page: number; quote: string }[];
  weights?: { what: string; percent: number | null; page: number; quote: string }[];
  flags: {
    kind: string;
    basis: string;
    percent: number | null;
    page: number;
    quote: string;
  }[];
}
