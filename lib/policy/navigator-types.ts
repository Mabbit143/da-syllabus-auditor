/** Fixed registry: the client picks an id, never a path. Every file is a saved UO page under data/uo-policies. */
export const SITUATIONS = [
  {
    id: "accommodation",
    label: "I need an accommodation for a disability",
    want: "ask about disability accommodations for my courses",
    files: [
      { file: "005-aec-home.md", name: "Accessible Education Center" },
      { file: "072-aec-getting-started-0.md", name: "AEC: getting started" },
      { file: "086-aec-registration-process-what-expect.md", name: "AEC: registration process" },
    ],
  },
  {
    id: "grievance",
    label: "I want to dispute a grade or file a complaint about my course",
    want: "understand how to file a grievance about a grade or a course",
    files: [{ file: "048-provost-student-grievance-policy.md", name: "Student Grievance Policy" }],
  },
  {
    id: "harassment",
    label: "I experienced harassment or discrimination",
    want: "find out where to report harassment or discrimination",
    files: [{ file: "064-investigations-nondiscrimination.md", name: "Nondiscrimination" }],
  },
  {
    id: "misconduct",
    label: "I am accused of academic misconduct",
    want: "understand the process after an academic misconduct concern",
    files: [{ file: "009-conduct-home.md", name: "Student Conduct" }],
  },
  {
    id: "religious",
    label: "A class conflicts with my religious observance",
    want: "ask for accommodations for a religious observance",
    files: [{ file: "045-provost-religious-observance-accommodations-policy.md", name: "Religious Observance Policy" }],
  },
] as const;

export interface OfficeAnswer {
  office: string;
  contact: string;
  quote: string;
  page: number;
  source: string;
  url: string;
  /** False when a second model was available and did not name this office. */
  confirmedByBoth: boolean;
}

export interface NavigatorResult {
  id: string;
  label: string;
  offices: OfficeAnswer[];
  message: string;
  note: string;
}
