import assert from "node:assert/strict";
import { test } from "node:test";
import "../test-support/register-typescript.mjs";

// The audit reads printed facts from the evidence ledger first, so a report cannot contradict a
// figure the syllabus states, and the same text yields the same conclusions whatever the model proposes.

const GRADE_PAGE = `GRADED COURSE ACTIVITIES
Course grades will be based
on:
Points   Total
Weekly Quiz Modules   240   25%
Labs   300   25%
Lab Attendance   100   15%
Attendance   180   15%
Participation (In-class act.)   100   20%
Total   920   100%`;

const POLICY_PAGE = `COURSE POLICIES
Missed-Class/Absence Policy - Attendance will be taken in this course.
Students who miss class must secure notes from another student in the class.
Attendance is a large part of your grade, roughly 10% of it.`;

const SCHEDULE_PAGE = `COURSE SCHEDULE
Week   Activity   Date   Topic   Assignments   Due Date
1   Lecture   9/29   Introductory Remarks   Intro Module   10/1
2   Lecture   10/6   Antiquarianism   Quiz: Chapter 2   10/8
3   Lecture   10/13   Excavation   Midterm exam in class   10/15`;

type Candidate = Record<string, unknown>;

async function run(pageTexts: string[], candidates: { signals?: Candidate[]; flags?: Candidate[]; weights?: Candidate[]; assessments?: Candidate[] }) {
  // @ts-expect-error Native Node TS entry point.
  const { runAudit } = await import("./audit.ts");
  const pages = pageTexts.map((text, i) => ({ pageNumber: i + 1, text }));
  const model = async () => JSON.stringify({ assessments: [], signals: [], flags: [], weights: [], ...candidates });
  return runAudit({ requestId: "t", fileName: "t.pdf", pageCount: pages.length, pages }, model);
}

/** Narrows a looked-up section, failing the test if the report omitted it. */
function present<T>(value: T | undefined, what: string): T {
  assert.ok(value !== undefined, `the report has no ${what}`);
  return value;
}

const passageOf = (report: { passages: { id: string; text: string }[] }, id: string) =>
  report.passages.find((p) => p.id === id)?.text ?? "";

test("a stated attendance share replaces \"no figure is stated\"", async () => {
  const report = await run([GRADE_PAGE, POLICY_PAGE], {
    flags: [{ kind: "attendance", basis: "counted_no_figure", percent: null, page: 2, quote: "Attendance will be taken in this course." }],
  });
  const attendance = report.flags.filter((f: { kind: string }) => f.kind === "attendance");
  assert.equal(attendance.length, 1);
  assert.doesNotMatch(attendance[0].explanation, /no figure/i);
  assert.match(attendance[0].explanation, /Lab Attendance 15%, Attendance 15%/);
  assert.match(attendance[0].explanation, /30% in total/);
  assert.equal(attendance[0].severity, "high");
  // The citation is the row that states the figure, not the vague sentence, and every row is cited.
  assert.match(passageOf(report, attendance[0].passageId), /Lab Attendance\s+100\s+15%/);
  assert.equal(attendance[0].passageIds?.length, 2);
  for (const id of attendance[0].passageIds ?? []) assert.match(passageOf(report, id), /15%/);
});

test("the printed table also replaces a percentage the model read from prose", async () => {
  const report = await run([GRADE_PAGE, POLICY_PAGE], {
    flags: [{ kind: "attendance", basis: "penalty_percent", percent: 10, page: 2, quote: "Attendance is a large part of your grade, roughly 10% of it." }],
  });
  const attendance = report.flags.filter((f: { kind: string }) => f.kind === "attendance");
  assert.equal(attendance.length, 1);
  assert.match(attendance[0].explanation, /30% in total/);
  assert.doesNotMatch(attendance[0].explanation, /\b10%/);
});

test("graded attendance is reported even when the model proposes no flag at all", async () => {
  const report = await run([GRADE_PAGE, POLICY_PAGE], {});
  const attendance = report.flags.filter((f: { kind: string }) => f.kind === "attendance");
  assert.equal(attendance.length, 1);
  assert.match(attendance[0].explanation, /counts toward the grade/);
  assert.match(passageOf(report, attendance[0].passageId), /15%/);
});

test("prose describing a threshold never becomes an attendance flag", async () => {
  const report = await run(["Students with attendance below 75% may be asked to withdraw from the course."], {});
  assert.equal(report.flags.some((f: { kind: string }) => f.kind === "attendance"), false);
});

test("severity follows the largest printed row, not the sum of the rows", async () => {
  const report = await run(["Lecture Attendance   50   5%\nLab Attendance   50   5%\nFinal project   900   90%"], {});
  const attendance = present(report.flags.find((f: { kind: string }) => f.kind === "attendance"), "attendance flag");
  assert.equal(attendance.severity, "medium"); // each printed row is 5%; only the sum reaches 10%
  assert.match(attendance.explanation, /10% in total/);
});

test("the printed table decides the weight sum, so a partial model list raises no false flag", async () => {
  const report = await run([GRADE_PAGE], {
    weights: [
      { what: "Weekly Quiz Modules", percent: 25, page: 1, quote: "Weekly Quiz Modules   240   25%" },
      { what: "Labs", percent: 25, page: 1, quote: "Labs   300   25%" },
    ],
  });
  assert.equal(report.flags.some((f: { kind: string }) => f.kind === "weight"), false);
});

test("a table whose rows do not reach 100% is still flagged from the ledger", async () => {
  const report = await run(["Points   Total\nMidterm   100   30%\nFinal   100   40%"], {});
  const weight = present(report.flags.find((f: { kind: string }) => f.kind === "weight"), "weight flag");
  assert.match(weight.explanation, /add up to 70%/);
});

test("stray percentages elsewhere in the document cannot inflate the weight sum", async () => {
  const page = `Points   Total
Midterm   100   25%
Final   100   25%
Project   200   50%
Participation grades will be curved   15%
Attendance, if required   10%`;
  const report = await run([page], {
    weights: [
      { what: "Midterm", percent: 25, page: 1, quote: "Midterm   100   25%" },
      { what: "Final", percent: 25, page: 1, quote: "Final   100   25%" },
      { what: "Project", percent: 50, page: 1, quote: "Project   200   50%" },
    ],
  });
  assert.equal(report.flags.some((f: { kind: string }) => f.kind === "weight"), false);
});

test("two printed percentages for one component are shown to the student, citing both", async () => {
  const report = await run(["Attendance   180   15%\nLabs   300   25%", "Attendance   120   10%"], {});
  const transparency = present(report.dimensions.find((d: { dimension: string }) => d.dimension === "transparency"), "transparency dimension");
  const conflict = present(transparency.hits.find((h: { code: string }) => h.code === "T7"), "conflict hit");
  assert.match(conflict.label, /15% and 10%/);
  assert.match(passageOf(report, conflict.passageId), /15%/);
  assert.match(passageOf(report, present(conflict.pairedPassageId, "paired passage")), /10%/);
  assert.equal(report.flags.some((f: { kind: string }) => f.kind === "weight"), false); // a conflict is not summed
});

test("a weights claim whose quote states no figure does not count as transparency evidence", async () => {
  const report = await run([GRADE_PAGE], {
    signals: [{ code: "T1", page: 1, quote: "Course grades will be based" }],
  });
  const transparency = present(report.dimensions.find((d: { dimension: string }) => d.dimension === "transparency"), "transparency dimension");
  assert.equal(transparency.positive, 0);
  assert.equal(transparency.hits.length, 0);
  assert.ok(transparency.notes?.some((n: string) => /states no percentage or share/i.test(n)));
});

test("a weights claim quoting a row that states a figure still counts", async () => {
  const report = await run([GRADE_PAGE], {
    signals: [{ code: "T1", page: 1, quote: "Weekly Quiz Modules   240   25%" }],
  });
  const transparency = present(report.dimensions.find((d: { dimension: string }) => d.dimension === "transparency"), "transparency dimension");
  assert.equal(transparency.positive, 1);
});

test("a bare point count is not a stated grade weight, but a stated fraction is", async () => {
  const points = await run(["You need 180 points to pass this course and nothing else matters here."], {
    signals: [{ code: "T1", page: 1, quote: "You need 180 points to pass this course" }],
  });
  assert.equal(present(points.dimensions.find((d: { dimension: string }) => d.dimension === "transparency"), "transparency").positive, 0);

  const fraction = await run(["The midterm is one third of your final grade in this course."], {
    signals: [{ code: "T1", page: 1, quote: "The midterm is one third of your final grade" }],
  });
  assert.equal(present(fraction.dimensions.find((d: { dimension: string }) => d.dimension === "transparency"), "transparency").positive, 1);
});

test("an assessment placed in a week the schedule contradicts is dropped and disclosed", async () => {
  const report = await run([SCHEDULE_PAGE], {
    assessments: [{ what: "Quiz: Chapter 2", week: 3, percent: null, page: 1, quote: "2   Lecture   10/6   Antiquarianism   Quiz: Chapter 2   10/8" }],
  });
  assert.equal(report.assessments.length, 0);
  assert.equal(report.coverage.status, "partial");
  assert.ok(report.coverage.skipped.some((s: string) => /left off the week map/i.test(s)));
});

test("an assessment whose quote prints its own week's date is kept", async () => {
  const report = await run([SCHEDULE_PAGE], {
    assessments: [{ what: "Quiz: Chapter 2", week: 2, percent: null, page: 1, quote: "2   Lecture   10/6   Antiquarianism   Quiz: Chapter 2   10/8" }],
  });
  assert.deepEqual(report.assessments.map((a: { what: string; week: number }) => [a.what, a.week]), [["Quiz: Chapter 2", 2]]);
  assert.equal(report.coverage.status, "full");
});

test("an assessment quoted from a single table cell keeps the week it sits under", async () => {
  const report = await run([SCHEDULE_PAGE], {
    assessments: [{ what: "Midterm", week: 3, percent: null, page: 1, quote: "Midterm exam in class" }],
  });
  assert.deepEqual(report.assessments.map((a: { week: number }) => a.week), [3]);
});

test("without a printed schedule, a verified assessment keeps its proposed week", async () => {
  const report = await run(["Assignments: the midterm exam is held in the fifth week of the term."], {
    assessments: [{ what: "Midterm", week: 5, percent: null, page: 1, quote: "the midterm exam is held in the fifth week of the term" }],
  });
  assert.equal(report.assessments.length, 1);
  assert.equal(report.assessments[0].week, 5);
});

test("one rule stated twice is one finding citing both passages", async () => {
  const page = `COURSE POLICIES
Late work loses points at five points per day after the due date shown.
Assignments handed in after the deadline lose points, with no exceptions made.`;
  const report = await run([page], {
    flags: [
      { kind: "late", basis: "deduction", percent: null, page: 1, quote: "Late work loses points at five points per day" },
      { kind: "late", basis: "deduction", percent: null, page: 1, quote: "Assignments handed in after the deadline lose points" },
    ],
  });
  const late = report.flags.filter((f: { kind: string }) => f.kind === "late");
  assert.equal(late.length, 1);
  assert.equal(late[0].passageIds?.length, 2);
  for (const id of late[0].passageIds ?? []) assert.match(passageOf(report, id), /lose|loses/);
});

test("the same text gives the same flags and assessments however the model orders its proposals", async () => {
  const flags = [
    { kind: "attendance", basis: "counted_no_figure", percent: null, page: 2, quote: "Attendance will be taken in this course." },
    { kind: "late", basis: "deduction", percent: null, page: 2, quote: "Students who miss class must secure notes from another student" },
  ];
  const first = await run([GRADE_PAGE, POLICY_PAGE], { flags });
  const second = await run([GRADE_PAGE, POLICY_PAGE], { flags: [...flags].reverse() });
  const shape = (r: { flags: { kind: string; severity: string; explanation: string }[] }) =>
    r.flags.map((f) => [f.kind, f.severity, f.explanation]).sort();
  assert.deepEqual(shape(first), shape(second));
});
