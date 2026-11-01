import type { Dimension, DimensionResult, Overall } from "./types";
import type { Relation } from "./policy/types";

export const AREA_LABELS: Record<Dimension, string> = {
  transparency: "Grades, dates, and expectations",
  punitive: "Late work and missed class",
  accessibility: "Getting support and accessing materials",
  perspectives: "Whose ideas and experiences are included",
  hidden: "Expectations you should not have to guess",
};

const DECISIVE: Record<Dimension, { strong: string; weak: string }> = {
  transparency: { strong: "Key details are explained", weak: "Important details are unclear" },
  punitive: { strong: "Options are explained", weak: "Strict rules to check" },
  accessibility: { strong: "Support options are explained", weak: "Barriers to check" },
  perspectives: { strong: "Different perspectives are included", weak: "A narrow range of perspectives" },
  hidden: { strong: "Expectations are spelled out", weak: "Important expectations are unexplained" },
};

export function areaStatus(area: DimensionResult): string {
  if (area.status === "not_assessed") return "We could not check this area.";
  if (area.status === "not_found")
    return area.notes?.length
      ? "We found related wording, but could not confirm this."
      : "We did not find this in the syllabus.";
  if (area.status === "mixed")
    return area.positive > 0 && area.negative > 0
      ? "The wording points in different directions."
      : "We found too little to draw a clear conclusion.";
  return DECISIVE[area.dimension][area.status];
}

export const OVERALL_LABEL: Record<NonNullable<Overall["label"]>, string> = {
  "inclusive leaning": "The rules lean more toward flexibility and support.",
  mixed: "Some rules offer support; others need a closer look.",
  "old-guard leaning": "The rules lean more toward restrictions than flexibility.",
};

export function overallPlain(overall: Overall): string {
  if (!overall.label) return "We could not check enough areas to give an overall summary.";
  return OVERALL_LABEL[overall.label];
}

export const RELATION_PLAIN: Record<Relation, string> = {
  matches: "These rules agree.",
  conflicts: "These rules say different things.",
  adds_requirement: "The syllabus adds a requirement.",
  silent: "The school has a rule; we did not find it in your syllabus.",
  disputed: "The checks disagree. Read both rules before drawing a conclusion.",
};
