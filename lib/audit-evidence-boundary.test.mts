import assert from "node:assert/strict";
import { after, test } from "node:test";
// @ts-expect-error Runtime Node 24 hook API predates the project's Node 20 types.
import { registerHooks } from "node:module";
import "../test-support/register-typescript.mjs";

// Synthetic source fixtures; real ledger, quote verifier, audit and rubric. Only the independent
// consistency provider is stubbed. No search is supplied; every unexpected fetch fails closed.
process.env.MODEL_API_KEY = "";
process.env.BASETEN_API_KEY = "";
process.env.MODEL_PROVIDER = "meta";
let unexpectedFetches = 0;
globalThis.fetch = async () => {
  unexpectedFetches++;
  throw new Error("Network forbidden in evidence-boundary regressions");
};
registerHooks({ load(url: string, context: object, next: (url: string, context: object) => unknown) {
  if (url.endsWith("/lib/meta.ts")) return {
    format: "module", shortCircuit: true,
    source: "export async function runAgent() { return { text: 'done', turns: 0 }; }",
  };
  return next(url, context);
} });
// @ts-expect-error Native Node TS entry point.
const { runAudit } = await import("./audit.ts");

type Candidate = Record<string, unknown>;
async function audit(texts: string[], proposals: { flags?: Candidate[]; assessments?: Candidate[]; signals?: Candidate[] } = {}) {
  const pages = texts.map((text, i) => ({ pageNumber: i + 1, text }));
  const report = await runAudit({ requestId: "offline-boundary", fileName: "synthetic.txt", pageCount: pages.length, pages },
    async () => JSON.stringify({ signals: [], flags: [], assessments: [], weights: [], ...proposals }));
  for (const p of report.passages) {
    assert.equal(pages[p.page - 1].text.slice(p.start, p.end), p.text, "citation must be an original source span");
  }
  return report;
}
const attendanceProposal = (quote: string, basis = "counted_no_figure", percent: number | null = null) =>
  ({ kind: "attendance", basis, percent, page: 1, quote });

after(() => assert.equal(unexpectedFetches, 0, "no provider/network boundary may be reached"));

test("an attendance quote saying it is not given a formal grade cannot become a graded-attendance risk", async () => {
  // Synthetic near-shape of a real Canvas syllabus sentence that became the report's biggest risk.
  const negated = "Class attendance is not given a formal grade here.";
  const report = await audit([negated], { flags: [attendanceProposal(negated)] });
  assert.equal(report.flags.some((f) => f.kind === "attendance"), false);
  assert.equal(report.biggestRiskIndex, null);
  assert.ok(report.coverage.skipped.some((s) => /attendance.*not graded/i.test(s)));
  // Near miss: the same predicate without the negation still supports the risk.
  const affirmed = "Class attendance is given a formal grade each week.";
  const kept = await audit([affirmed], { flags: [attendanceProposal(affirmed)] });
  assert.equal(kept.flags.filter((f) => f.kind === "attendance").length, 1);
});

test("a no-route accommodation note is not shown beside an accepted statement that names the office", async () => {
  const routed = "Students with disabilities may request accommodations by contacting the Accessible Education Center (AEC) at access@example.edu.";
  const invited = "If you have a documented disability, you are invited to let me know.";
  const signals = [routed, invited].map((quote) => ({ code: "A1", page: 1, quote }));
  const report = await audit([`${invited}\n${routed}`], { signals });
  const access = report.dimensions.find((d) => d.dimension === "accessibility")!;
  assert.equal(access.hits.filter((h) => h.code === "A1").length, 1);
  assert.equal((access.notes ?? []).some((n) => /names no office/.test(n)), false);
  // Near miss: with no routed statement anywhere, the honest note remains.
  const alone = await audit([invited], { signals: [{ code: "A1", page: 1, quote: invited }] });
  assert.ok((alone.dimensions.find((d) => d.dimension === "accessibility")!.notes ?? []).some((n) => /names no office/.test(n)));
});

test("attendance restatements are one component with every source citation", async () => {
  const prose = "Attendance counts for 15% of the final course grade.";
  for (const text of [`Attendance   15%\nFinal project   85%\n${prose}`, `${prose}\n${prose}`]) {
    const report = await audit([text]);
    const flags = report.flags.filter((f) => f.kind === "attendance");
    assert.equal(flags.length, 1);
    assert.match(flags[0].explanation, /\(15%\)/);
    assert.doesNotMatch(flags[0].explanation, /30%|in total/);
    assert.equal(flags[0].passageIds?.length, 2);
    assert.equal(new Set(flags[0].passageIds).size, 2);
  }
});

test("repeated attendance prose without terminal punctuation is still one component", async () => {
  const prose = "Attendance counts for 15% of the final course grade";
  const report = await audit([`${prose}\n${prose}`]);
  assert.equal(report.flags.length, 1);
  assert.match(report.flags[0].explanation, /\(15%\)/);
  assert.equal(report.flags[0].passageIds?.length, 2);
});

test("explicit attendance prose share replaces the contradictory no-figure proposal", async () => {
  const text = "Attendance counts for 15% of the final course grade.";
  const report = await audit([text], { flags: [attendanceProposal(text)] });
  assert.equal(report.flags.length, 1);
  assert.match(report.flags[0].explanation, /15%/);
  assert.doesNotMatch(report.flags[0].explanation, /no figure/i);
  assert.equal(report.flags[0].severity, "high");
  assert.equal(report.passages.find((p) => p.id === report.flags[0].passageId)?.text, text);
  assert.equal(report.coverage.status, "full", "a proposal the ledger answers is replaced, not reported as left out");
});

test("a conditional attendance share stays unresolved with the complete condition visible", async () => {
  const text = "Attendance counts for 15% of the final course grade only if you opt into the attendance track.";
  for (const proposals of [{}, { flags: [attendanceProposal(text, "penalty_percent", 15)] },
    { flags: [attendanceProposal("Attendance counts for 15% of the final course grade", "penalty_percent", 15)] }]) {
    const report = await audit([text], proposals);
    assert.equal(report.flags.some((f) => f.kind === "attendance"), false);
    assert.equal(report.coverage.status, "partial");
    assert.ok(report.coverage.skipped.some((s) => /conditional|unresolved/i.test(s)));
    assert.ok(report.passages.some((p) => p.text === text));
    assert.ok(report.dimensions.some((d) => d.notes?.some((n) => n.includes(text))));
  }
});

test("line-wrap whitespace cannot cut a condition off an attendance share", async () => {
  const text = "Attendance counts for 15% of the final course grade\nonly if you opt into the attendance track.";
  const report = await audit([text]);
  assert.equal(report.flags.some((f) => f.kind === "attendance"), false);
  assert.ok(report.passages.some((p) => p.text === text));
  assert.ok(report.coverage.skipped.some((s) => /unresolved/.test(s)));
});

test("conflicting attendance prose shares stay unresolved and cite both values", async () => {
  const a = "Attendance counts for 15% of the final course grade.";
  const b = "Attendance counts for 10% of the final course grade.";
  const report = await audit([a, b], { flags: [attendanceProposal(a)] });
  assert.equal(report.flags.some((f) => f.kind === "attendance"), false);
  const conflict = report.dimensions.find((d) => d.dimension === "transparency")?.hits.find((h) => h.code === "T7");
  assert.ok(conflict, "conflicting attendance shares need a cited conflict, not no-figure wording");
  assert.match(conflict.label, /15% and 10%/);
  assert.equal(report.passages.find((p) => p.id === conflict.passageId)?.text, a);
  assert.equal(report.passages.find((p) => p.id === conflict.pairedPassageId)?.text, b);
});

test("adjacent attendance sentences both contribute evidence, including a conflict", async () => {
  const a = "Attendance counts for 15% of the final course grade.";
  const b = "Attendance counts for 10% of the final course grade.";
  const report = await audit([`${a} ${b}`]);
  assert.equal(report.flags.some((f) => f.kind === "attendance"), false);
  const conflict = report.dimensions.find((d) => d.dimension === "transparency")?.hits.find((h) => h.code === "T7");
  assert.ok(conflict);
  assert.match(conflict.label, /15% and 10%/);
  assert.equal(report.passages.find((p) => p.id === conflict.passageId)?.text, a);
  assert.equal(report.passages.find((p) => p.id === conflict.pairedPassageId)?.text, b);
  const repeated = await audit([`${a} ${a}`]);
  assert.match(repeated.flags[0].explanation, /\(15%\)/);
  assert.equal(repeated.flags[0].passageIds?.length, 2);
});

test("a negated attendance-grading quote cannot become a graded-attendance risk", async () => {
  const negated = "Attendance is not formally graded, but regular participation helps your learning.";
  const report = await audit([negated], { flags: [attendanceProposal(negated)] });
  assert.equal(report.flags.some((f) => f.kind === "attendance"), false);
  assert.equal(report.biggestRiskIndex, null);
  assert.ok(report.coverage.skipped.some((s) => /attendance.*not graded/i.test(s)), "the rejected proposal is disclosed");

  // Near miss: the same shape without the negation still counts, with no stated figure.
  const affirmed = "Attendance is formally graded, and regular participation helps your learning.";
  const kept = await audit([affirmed], { flags: [attendanceProposal(affirmed)] });
  assert.equal(kept.flags.length, 1);
  assert.match(kept.flags[0].explanation, /no figure is stated/);
  const notOptional = "Attendance is not optional in this course; it is graded each week.";
  assert.equal((await audit([notOptional], { flags: [attendanceProposal(notOptional)] })).flags.length, 1);
});

test("isn't optional is not a negated grading predicate", async () => {
  const affirmed = "Attendance isn't optional; it is graded each week.";
  const report = await audit([affirmed], { flags: [attendanceProposal(affirmed)] });
  assert.equal(report.flags.length, 1);
  assert.match(report.flags[0].explanation, /no figure is stated/);
  for (const text of ["Attendance isn't graded each week.", "Attendance isn’t formally graded.", "Attendance is ungraded."]) {
    const rejected = await audit([text], { flags: [attendanceProposal(text)] });
    assert.equal(rejected.flags.length, 0, text);
    assert.ok(rejected.coverage.skipped.some((s) => /attendance finding was left out/.test(s)), text);
  }
});

test("a stated automatic fail or drop for absences is kept even when attendance earns no points", async () => {
  const text = "Attendance is not formally graded; however, students with more than four unexcused absences will fail the course.";
  const report = await audit([text], { flags: [attendanceProposal(text, "fail_or_drop")] });
  assert.equal(report.flags.length, 1);
  assert.equal(report.flags[0].severity, "high");
  assert.match(report.flags[0].explanation, /fail/i);
  assert.equal(report.passages.find((p) => p.id === report.flags[0].passageId)?.text, text);
});

test("fail-or-drop requires an affirmative absence-linked consequence, not another subject or negation", async () => {
  for (const text of [
    "Attendance is not graded; students who plagiarize will fail the course.",
    "Attendance is not graded; there is no automatic failure for absences.",
    "Students with four absences will not fail the course.",
    "Absences are recorded, but students who plagiarize will fail the course.",
  ]) {
    const report = await audit([text], { flags: [attendanceProposal(text, "fail_or_drop")] });
    assert.equal(report.flags.some((f) => f.kind === "attendance"), false, text);
    assert.ok(report.coverage.skipped.some((s) => /attendance finding was left out/.test(s)), text);
  }
  for (const text of [
    "Students with four absences will fail the course.",
    "Students who miss more than four classes will be dropped from the course.",
    "More than four absences result in automatic failure.",
  ]) {
    const report = await audit([text], { flags: [attendanceProposal(text, "fail_or_drop")] });
    assert.equal(report.flags[0]?.severity, "high", text);
    assert.equal(report.passages.find((p) => p.id === report.flags[0].passageId)?.text, text);
  }
});

test("a fail-or-drop proposal needs the clause to state that consequence, not a learning consequence", async () => {
  const text = "Attendance is not formally graded, but missing class will make the exams much harder.";
  const report = await audit([text], { flags: [attendanceProposal(text, "fail_or_drop")] });
  assert.equal(report.flags.some((f) => f.kind === "attendance"), false);
});

test("an attendance percent must belong to an attendance grade or absence penalty, not late work", async () => {
  for (const text of [
    "Attendance contributes to learning; late work loses 15% per day.",
    "Attendance contributes to learning, and late work loses 15% per day.",
    "Attendance counts toward the grade; the final exam is 15% of the grade.",
    "Attendance does not reduce the final grade by 15%.",
  ]) {
    const report = await audit([text], { flags: [attendanceProposal(text, "penalty_percent", 15)] });
    assert.equal(report.flags.some((f) => f.kind === "attendance"), false, text);
    assert.ok(report.coverage.skipped.some((s) => /attendance finding was left out/.test(s)), text);
  }
  for (const text of [
    "Attendance counts for 15% of the final course grade.",
    "Each unexcused absence reduces your final grade by 15%.",
    "You lose 15% of the final course grade for each unexcused absence.",
  ]) {
    const report = await audit([text], { flags: [attendanceProposal(text, "penalty_percent", 15)] });
    assert.equal(report.flags[0]?.severity, "high", text);
    assert.match(report.flags[0].explanation, /15%/);
  }
});

test("an exact printed attendance row remains positive percentage evidence", async () => {
  const text = "Attendance   15%\nFinal project   85%";
  const report = await audit([text], { flags: [attendanceProposal("Attendance   15%", "penalty_percent", 15)] });
  assert.equal(report.flags.filter((f) => f.kind === "attendance").length, 1);
  assert.match(report.flags[0].explanation, /15%/);
  assert.equal(report.coverage.status, "full");
});

test("a 15% absence threshold is not reported as a 15% grade share or as no figure", async () => {
  const text = "Students who miss more than 15% of class sessions will be dropped from the course.";
  const proposedShare = await audit([text], { flags: [attendanceProposal(text)] });
  for (const f of proposedShare.flags) {
    assert.doesNotMatch(f.explanation, /no figure|15%\)|\(15%/i, "threshold must not be presented as a share or as no figure");
  }
  const proposedPenalty = await audit([text], { flags: [attendanceProposal(text, "penalty_percent", 15)] });
  for (const f of proposedPenalty.flags) assert.doesNotMatch(f.explanation, /15%/, "a session threshold is not a grade penalty");
  const failDrop = await audit([text], { flags: [attendanceProposal(text, "fail_or_drop")] });
  assert.equal(failDrop.flags.length, 1);
  assert.match(failDrop.flags[0].explanation, /dropped/);
});

test("an attendance share elsewhere answers a no-number fragment; unrelated percents do not", async () => {
  const page = "Attendance will be taken at every class meeting.\nAttendance counts for 15% of the final course grade.";
  const report = await audit([page], { flags: [attendanceProposal("Attendance will be taken at every class meeting.")] });
  assert.equal(report.flags.length, 1);
  assert.match(report.flags[0].explanation, /15%/);
  assert.match(report.passages.find((p) => p.id === report.flags[0].passageId)?.text ?? "", /counts for 15%/);

  const unrelated = "Attendance will be taken at every class meeting.\nLate work loses 15% of its value per day.\nThe final exam is worth 40% of the course grade.";
  const plain = await audit([unrelated], { flags: [attendanceProposal("Attendance will be taken at every class meeting.")] });
  const attendance = plain.flags.filter((f) => f.kind === "attendance");
  assert.equal(attendance.length, 1);
  assert.match(attendance[0].explanation, /no figure is stated/);
});

test("lecture and lab attendance prose shares stay distinct and are never summed into one stated figure", async () => {
  const page = "Lecture attendance counts for 5% of the final course grade.\nLab attendance counts for 10% of the final course grade.";
  const report = await audit([page], {});
  const attendance = report.flags.filter((f) => f.kind === "attendance");
  assert.equal(attendance.length, 1);
  assert.match(attendance[0].explanation, /Lecture attendance 5%, Lab attendance 10% \(15% in total\)/);
  assert.equal(attendance[0].severity, "high"); // largest printed share is 10%
  assert.equal(attendance[0].passageIds?.length, 2);
});

test("attendance points are never converted into a percentage", async () => {
  const page = "Attendance counts for 50 points of the final course grade, out of 500 points.";
  const report = await audit([page], { flags: [attendanceProposal(page)] });
  for (const f of report.flags) assert.doesNotMatch(f.explanation, /10%|\d+%/);
});

const assessment = (what: string, week: number, quote: string) => ({ what, week, percent: null, page: 1, quote });
const weekMap = (r: { assessments: { what: string; week: number }[] }) => r.assessments.map((a) => [a.what, a.week]);

test("without a recognized schedule, an arbitrary week on an undated quote is left off and disclosed", async () => {
  const text = "The final paper is required for completion of this course.";
  const report = await audit([text], { assessments: [assessment("Final paper", 1, text)] });
  assert.deepEqual(weekMap(report), []);
  assert.equal(report.coverage.status, "partial");
  assert.ok(report.coverage.skipped.some((s) => /left off the week map/.test(s)));
});

test("without a schedule, explicit numeric and ordinal week wording still places an assessment", async () => {
  const page = "Assignments: the midterm exam is held in week 5. The final paper is due in the ninth week of the term.";
  const report = await audit([page], { assessments: [
    assessment("Midterm", 5, "the midterm exam is held in week 5"),
    assessment("Final paper", 9, "The final paper is due in the ninth week of the term"),
  ] });
  assert.deepEqual(weekMap(report), [["Midterm", 5], ["Final paper", 9]]);
  assert.equal(report.coverage.status, "full");
});

test("without a schedule, a quote naming a different week or only a date does not support the proposed week", async () => {
  const page = "The midterm exam is held in week 3. The lab report is due 10/15.";
  const report = await audit([page], { assessments: [
    assessment("Midterm", 4, "The midterm exam is held in week 3"),
    assessment("Lab report", 4, "The lab report is due 10/15"),
  ] });
  assert.deepEqual(weekMap(report), []);
  assert.ok(report.coverage.skipped.some((s) => /2 deadlines were left off the week map/.test(s)));
});

test("a recurring week phrase is not a week placement", async () => {
  const text = "A short reflection is due every second week of the term.";
  const report = await audit([text], { assessments: [assessment("Reflection", 2, text)] });
  assert.deepEqual(weekMap(report), []);
});

test("negated and whitespace-varied recurring ordinal weeks cannot place a deadline", async () => {
  for (const text of [
    "A short reflection is not due in the second week; it is due in week 8.",
    "A short reflection is due every  second week of the term.",
    "A short reflection is due every\n  second week of the term.",
  ]) {
    const report = await audit([text], { assessments: [assessment("Reflection", 2, text)] });
    assert.deepEqual(weekMap(report), [], text);
    assert.ok(report.coverage.skipped.some((s) => /left off the week map/.test(s)), text);
  }
  const corrected = "A short reflection is not due in the second week; it is due in week 8.";
  assert.deepEqual(weekMap(await audit([corrected], { assessments: [assessment("Reflection", 8, corrected)] })), [["Reflection", 8]]);
  const genuine = "A short reflection is due in the  second week of the term.";
  assert.deepEqual(weekMap(await audit([genuine], { assessments: [assessment("Reflection", 2, genuine)] })), [["Reflection", 2]]);
});

test("a later section on a schedule page is not enclosed by the nearest previous week header", async () => {
  const final = "The final paper is due 12/8.";
  const text = `Week 1\nRead the overview\nWeek 2\nRead chapter two\nIMPORTANT DATES\n${final}`;
  const report = await audit([text], { assessments: [assessment("Final paper", 2, final)] });
  assert.deepEqual(weekMap(report), []);
  assert.ok(report.coverage.skipped.some((s) => /left off the week map/.test(s)));
});

test("a no-figure proposal whose own quote prints an unrecognized percentage fails closed", async () => {
  const text = "Attendance is roughly 15% of what I weigh when assigning participation marks.";
  const report = await audit([text], { flags: [attendanceProposal(text)] });
  assert.equal(report.flags.some((f) => f.kind === "attendance"), false, "neither 'no figure' nor an unproven 15% share");
  assert.ok(report.coverage.skipped.some((s) => /attendance finding was left out/.test(s)));
});
