import type { PolicyCheck } from "./policy/types";

export type Dimension ="transparency" | "punitive" | "accessibility" | "perspectives" | "hidden";

export type DimensionStatus = "strong" | "weak" | "mixed" | "not_found" | "not_assessed";

export type Severity = "high" | "medium";

export type FlagKind = "attendance" | "weight" | "late";

export interface Page {
  pageNumber: number;
  text: string;
  /** Set when this page came from one piece of a syllabus assembled from several Canvas pages/files. */
  source?: string;
  /**
   * This page's own number inside its piece (the piece's input page number, or its position when
   * the input page had no usable number). Set by mergePieces. Absent on reports saved before
   * 2026-10-31; for those the page within the piece is unknown and is never guessed.
   */
  sourcePageNumber?: number;
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
  /** A direct, named characterization of this dimension's verified stance (e.g. "Punitive"), code-decided from hits. Owner decision 2026-10-30: name it plainly instead of only reporting a status. */
  characterization?: string;
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
  /** A one-line plain-language characterization built from the dimensions' own characterizations. Owner decision 2026-10-30. */
  characterization?: string;
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

/** What a sampled reading-list author's public-bio check ended at. Hits also appear as P6/P7 evidence. */
export type AuthorBioOutcome = "insider_stated" | "outsider_stated" | "no_stated_relation" | "not_found" | "bio_unverified" | "check_failed";
export interface AuthorBioCheck {
  author: string;
  title: string;
  /** What the reading covers, from the syllabus text: the community the bio is judged against. */
  topic?: string;
  outcome: AuthorBioOutcome;
  /** Where the bio was found, when one was. */
  url?: string;
  /** Up to 3 verified bio pieces consulted for this author (owner decision 2026-11-03). */
  pieces?: { quote: string; url: string; relation: "insider_stated" | "outsider_stated" | "unclear" }[];
}
export interface SourceAuthors {
  /** Verified distinct reading-list authors, before any cap. */
  verified: number;
  /** How many were looked up: all of them, or a random sample of the cap (12). */
  sampled: number;
  authors: AuthorBioCheck[];
}

export interface AuditReport {
  /** Set when the page text came from OCR of page images, so it may contain reading errors. */
  textSource?: "ocr";
  /** Set when some model steps ran on the Baseten fallback because Meta did not answer. */
  modelNote?: string;
  /** Set when this syllabus was assembled from more than one piece (e.g. scattered Canvas pages); the scattering itself is disclosed. */
  sources?: { label: string; pageCount: number }[];
  policyCheck?: PolicyCheck;
  assessments: Assessment[];
  fileName: string;
  /** Optional student-supplied course identifier; older reports use their filename for department grouping. */
  courseCode?: string;
  pageCount: number;
  coverage: Coverage;
  dimensions: DimensionResult[];
  flags: FlagResult[];
  biggestRiskIndex: number | null;
  overall: Overall;
  passages: Passage[];
  /** The reading-list author check's full outcome, so a grade is auditable even when no bio counted. */
  sourceAuthors?: SourceAuthors;
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
