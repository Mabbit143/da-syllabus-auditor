export const FUNDING_TYPES = ["scholarship", "grant", "fellowship", "emergency"] as const;
export type FundingType = (typeof FUNDING_TYPES)[number];

// Fixed vocabulary the model may tag a requirement with. Code compares these to the profile.
export const REQUIREMENT_FLAGS = [
  "first_gen", "returning", "low_income", "parent", "undergrad", "grad", "veteran", "disability", "transfer",
] as const;
export type RequirementFlag = (typeof REQUIREMENT_FLAGS)[number];

export interface Profile {
  major: string;
  school: string;
  location: string;
  hoursPerWeek: number;
  flags: RequirementFlag[];
  termStart: string | null; // ISO date; lets deadlines be compared with crunch weeks
}

export interface Candidate {
  type: string;
  title: string;
  sponsor: string;
  amount: number | null;
  deadline: string | null; // ISO date
  url: string;
  requires: string[];
  majors: string[];
  feeOrMembership: boolean;
  quotes: { amount?: string; deadline?: string; eligibility?: string };
}

export interface Opportunity {
  type: FundingType;
  title: string;
  sponsor: string;
  amount: number | null;
  deadline: string | null;
  url: string;
  requires: RequirementFlag[];
  majors: string[];
  quotes: { amount?: string; deadline?: string; eligibility: string };
}

export interface RankedOpportunity extends Opportunity {
  rank: number;
  why: string[];
  daysLeft: number | null;
  crunchWeek: number | null;
}
