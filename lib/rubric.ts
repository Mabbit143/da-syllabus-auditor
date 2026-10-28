import type { Dimension, DimensionResult, DimensionStatus, FlagKind, Overall, Severity } from "./types";

export const DIMENSIONS: { id: Dimension; title: string }[] = [
  { id: "transparency", title: "Transparency" },
  { id: "punitive", title: "Punitive vs. flexible" },
  { id: "accessibility", title: "Accessibility in practice" },
  { id: "perspectives", title: "Whose perspectives are in the room" },
  { id: "hidden", title: "Hidden curriculum" },
];

interface SignalDef {
  dimension: Dimension;
  polarity: 1 | -1;
  label: string;
}

// Signal codes from the approved spec section "Proposed grading rules".
export const SIGNALS: Record<string, SignalDef> = {
  T1: { dimension: "transparency", polarity: 1, label: "Grade weights or percentages stated" },
  T2: { dimension: "transparency", polarity: 1, label: "Due dates or a schedule stated" },
  T3: { dimension: "transparency", polarity: 1, label: "Grading criteria or scale stated" },
  T4: { dimension: "transparency", polarity: 1, label: "Contact, office hours or response time stated" },
  T5: { dimension: "transparency", polarity: -1, label: "A policy is referenced but left undefined" },
  T6: { dimension: "transparency", polarity: -1, label: "A term that changes grades or penalties is left undefined" },
  T7: { dimension: "transparency", polarity: -1, label: "Two stated counts, numbers or policies in the syllabus conflict" },
  T8: { dimension: "transparency", polarity: -1, label: "A grade scale or table is ambiguous (mixed units or missing bounds)" },
  T9: { dimension: "transparency", polarity: -1, label: "An unresolved placeholder, leftover drafting note or text error is left in the syllabus" },
  F1: { dimension: "punitive", polarity: 1, label: "Late work accepted with a stated allowance or extension process" },
  F2: { dimension: "punitive", polarity: 1, label: "Lowest scores dropped, or revision or resubmission allowed" },
  F3: { dimension: "punitive", polarity: 1, label: "Absences excused through a described process, or attendance not graded" },
  F4: { dimension: "punitive", polarity: -1, label: "Attendance counts toward the grade or is penalized" },
  F5: { dimension: "punitive", polarity: -1, label: "Late work penalized, zero credit or not accepted" },
  F6: { dimension: "punitive", polarity: -1, label: "\"No exceptions\" or no make-up stated" },
  A1: { dimension: "accessibility", polarity: 1, label: "Accommodation process stated (how, who or when to ask)" },
  A2: { dimension: "accessibility", polarity: 1, label: "Course-specific flexibility stated" },
  A3: { dimension: "accessibility", polarity: 1, label: "Free, open or library-provided materials stated" },
  A4: { dimension: "accessibility", polarity: -1, label: "Accommodation requires documentation or a deadline stated as a hurdle" },
  A5: { dimension: "accessibility", polarity: -1, label: "Required purchase of materials stated" },
  A6: { dimension: "accessibility", polarity: -1, label: "Rigid in-person or timed requirement with no stated alternative" },
  P1: { dimension: "perspectives", polarity: 1, label: "Goal or unit on varied communities, viewpoints or lived experience stated" },
  P2: { dimension: "perspectives", polarity: 1, label: "Student knowledge or experience invited as course content" },
  P3: { dimension: "perspectives", polarity: 1, label: "Choice among readings or topics stated" },
  P4: { dimension: "perspectives", polarity: -1, label: "Course framed around a single canon, tradition or viewpoint" },
  P5: { dimension: "perspectives", polarity: -1, label: "Text assumes uniform student circumstances" },
  P6: { dimension: "perspectives", polarity: 1, label: "Author's own bio states they belong to or come from the community or tradition the reading covers" },
  P7: { dimension: "perspectives", polarity: -1, label: "Author's own bio states a background outside the community or tradition the reading covers" },
  H1: { dimension: "hidden", polarity: 1, label: "Unwritten expectations made explicit" },
  H2: { dimension: "hidden", polarity: 1, label: "Jargon or terms explained" },
  H3: { dimension: "hidden", polarity: 1, label: "Weekly workload or how to succeed stated" },
  H4: { dimension: "hidden", polarity: -1, label: "A graded term has no criteria" },
  H5: { dimension: "hidden", polarity: -1, label: "Assumed insider knowledge" },
  H6: { dimension: "hidden", polarity: -1, label: "Grading described as subjective or discretionary with no criteria" },
};

export function gradeDimension(
  positive: number,
  negative: number,
  fullCoverage: boolean,
): DimensionStatus {
  if (positive >= 2 && negative === 0) return "strong";
  if (negative >= 2 && positive === 0) return "weak";
  if (positive + negative >= 1) return "mixed";
  return fullCoverage ? "not_found" : "not_assessed";
}

export function overallRead(dimensions: DimensionResult[]): Overall {
  const included = dimensions.filter((d) => d.status !== "not_found" && d.status !== "not_assessed");
  const score =
    included.filter((d) => d.status === "strong").length -
    included.filter((d) => d.status === "weak").length;
  if (included.length < 3) {
    return {
      label: null,
      reason: `Only ${included.length} of 5 dimensions had enough verified evidence (3 are needed).`,
      included: included.length,
      score,
    };
  }
  const label = score >= 2 ? "inclusive leaning" : score <= -2 ? "old-guard leaning" : "mixed";
  return {
    label,
    reason: `Based on ${included.length} of 5 dimensions: ${score >= 0 ? "+" : ""}${score} (Strong minus Weak).`,
    included: included.length,
    score,
  };
}

/**
 * Stated grade weights should reach 100%. Null means the sum cannot be judged from what was verified:
 * a component failed verification, one name has two different figures, or fewer than two components exist.
 */
export function weightSum(parts: { what: string; percent: number }[], unassessable: boolean): { sum: number; reaches100: boolean } | null {
  if (unassessable) return null;
  const byName = new Map<string, number>();
  for (const p of parts) {
    const key = p.what.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (byName.has(key) && byName.get(key) !== p.percent) return null;
    byName.set(key, p.percent);
  }
  if (byName.size < 2) return null;
  const sum = Math.round([...byName.values()].reduce((a, b) => a + b, 0) * 100) / 100;
  return { sum, reaches100: Math.abs(sum - 100) <= 1 }; // 1 point of slack covers 33.3 x 3
}

export const FLAG_BASES: Record<FlagKind, string[]> = {
  attendance: ["fail_or_drop", "penalty_percent", "counted_no_figure"],
  weight: ["single_assessment_percent"],
  late: ["zero_or_none", "deduction", "grace"],
};

export function flagSeverity(kind: FlagKind, basis: string, percent: number | null): Severity | null {
  if (kind === "attendance") {
    if (basis === "fail_or_drop") return "high";
    if (basis === "penalty_percent") return percent !== null && percent >= 10 ? "high" : "medium";
    if (basis === "counted_no_figure") return "medium";
  }
  if (kind === "weight" && basis === "single_assessment_percent" && percent !== null) {
    return percent >= 50 ? "high" : percent >= 35 ? "medium" : null;
  }
  if (kind === "late") {
    if (basis === "zero_or_none") return "high";
    if (basis === "deduction") return "medium";
  }
  return null;
}
