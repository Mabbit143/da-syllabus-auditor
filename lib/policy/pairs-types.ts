/** Fixed registry: the client picks an id, never a path. */
export const POLICY_PAIRS = [
  {
    id: "syllabus-requirement",
    label: "Syllabus requirement: Provost policy vs. Teaching site guidance",
    a: { file: "002-provost-syllabus-requirement-undergraduate-and-graduate-policy.md", name: "Provost policy" },
    b: { file: "006-teaching-syllabus.md", name: "Teaching site" },
  },
  {
    id: "attendance",
    label: "Attendance and engagement: Provost policy vs. Teaching site guidance",
    a: { file: "003-provost-undergraduate-course-attendance-and-engagement-policy.md", name: "Provost policy" },
    b: { file: "084-teaching-enacting-senates-course-attendance-and-engagement-policy-0.md", name: "Teaching site" },
  },
] as const;

export interface PairSide { name: string; url: string; page: number; quote: string }
export interface PairDifference { explanation: string; a: PairSide; b: PairSide }
export interface PairResult { id: string; label: string; differences: PairDifference[]; note: string }
