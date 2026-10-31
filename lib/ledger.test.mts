import assert from "node:assert/strict";
import { test } from "node:test";
import "../test-support/register-typescript.mjs";

// @ts-expect-error Native Node TS entry point.
const { buildLedger, attendanceFact, weekSupport, datesIn } = await import("./ledger.ts");

const pages = (...texts: string[]) => texts.map((text, i) => ({ pageNumber: i + 1, text }));

/** Asserts a ledger entry actually holds a value, then narrows it for the checks below. */
function must<T>(value: T | null | undefined): T {
  assert.ok(value !== null && value !== undefined, "expected the ledger entry to hold a value");
  return value;
}

// Shaped like a real grade table after PDF text extraction: name, points, percent in columns.
const GRADE_TABLE = `GRADED COURSE ACTIVITIES
Course grades will be based
on:
Points   Total
Weekly Quiz Modules   240   25%
Labs   300   25%
Lab Attendance   100   15%
Attendance   180   15%
Participation (In-class act.)   100   20%
Total   920   100%`;

const SCHEDULE = `COURSE SCHEDULE
Week   Activity   Date   Topic   Assignments   Due Date
1   Lecture   9/29   Introductory Remarks   Intro Module   10/1
Lab   10/2   Week 1 Lab   10/2
2   Lecture   10/6   Antiquarianism   Quiz: Chapter 2   10/8
Lab   10/9   Formation Processes   Week 2 Lab   10/9
3   Lecture   10/13   Excavation   Quiz: Chapter 3   10/15`;

/** A passage as the audit sees it: a verified span, with the offsets the quote was found at. */
const at = (text: string, within = SCHEDULE, page = 1) => {
  const start = within.indexOf(text);
  assert.ok(start >= 0, `fixture does not contain ${JSON.stringify(text)}`);
  return { page, start, text };
};

test("grade rows are read from the printed table, totals excluded", () => {
  const ledger = buildLedger(pages(GRADE_TABLE));
  assert.equal(ledger.gradeComponents.status, "found");
  assert.deepEqual(
    must(ledger.gradeComponents.value).map((c: { name: string; points: number | null; percent: number | null }) => [c.name, c.points, c.percent]),
    [["Weekly Quiz Modules", 240, 25], ["Labs", 300, 25], ["Lab Attendance", 100, 15], ["Attendance", 180, 15], ["Participation (In-class act.)", 100, 20]],
  );
  assert.equal(must(ledger.gradeComponents.value).some((c: { isTotal: boolean }) => c.isTotal), false);
});

test("a summary row is excluded however it is named", () => {
  for (const total of ["Total   920   100%", "Overall   100%", "Course grade   920   100%", "Final course total   100%"]) {
    const ledger = buildLedger(pages(`Midterm   30   30%\nFinal   70   70%\n${total}`));
    assert.deepEqual(must(ledger.gradeComponents.value).map((c: { name: string }) => c.name), ["Midterm", "Final"]);
  }
});

test("every grade fact carries the exact source span it came from", () => {
  const [page] = pages(GRADE_TABLE);
  const ledger = buildLedger([page]);
  for (const c of must(ledger.gradeComponents.value)) {
    assert.equal(page.text.slice(c.citation.start, c.citation.end), c.citation.text);
    assert.ok(c.citation.text.includes(c.name));
    assert.equal(c.citation.page, 1);
  }
});

test("lecture and lab attendance stay separate rows; the sum and the largest row are both reported", () => {
  const fact = must(attendanceFact(buildLedger(pages(GRADE_TABLE))));
  assert.deepEqual(fact.rows.map((r: { name: string }) => r.name), ["Lab Attendance", "Attendance"]);
  assert.equal(fact.total, 30);
  assert.equal(fact.largest, 15); // severity is judged on a printed row, never on the sum
});

test("a graded attendance row is found even when the table states no points", () => {
  const ledger = buildLedger(pages("Attendance and participation   15%\nFinal project   85%"));
  assert.equal(ledger.attendance.status, "found");
  assert.equal(must(attendanceFact(ledger)).total, 15);
  assert.equal(must(ledger.attendance.value)[0].points, null);
});

test("two percentages for one component are recorded as a conflict, with both spans", () => {
  const ledger = buildLedger(pages("Attendance   180   15%\nLabs   300   25%", "Attendance   120   10%"));
  assert.equal(ledger.gradeComponents.status, "conflict");
  assert.match(must(ledger.gradeComponents.explanation), /two different percentages for "Attendance": 15% and 10%/);
  const [a, b] = must(ledger.gradeComponents.conflictPair);
  assert.equal(a.page, 1);
  assert.equal(b.page, 2);
  assert.equal(ledger.attendance.status, "conflict");
  assert.equal(attendanceFact(ledger), null); // a conflict is never summed into one figure
});

test("a sentence stating a threshold never becomes an attendance figure", () => {
  for (const prose of [
    "Students with attendance below 75%",
    "The passing threshold is 60%",
    "Attendance is required and absences above 20%",
    "Late work loses 10% per day.",
    "Participation is worth up to 30%",
  ]) {
    const ledger = buildLedger(pages(prose));
    assert.equal(ledger.attendance.status, "not_found", prose);
    assert.equal(ledger.gradeComponents.status, "not_found", prose);
    assert.equal(attendanceFact(ledger), null, prose);
  }
});

test("a grade row needs table columns, not a single space before the percent", () => {
  assert.equal(buildLedger(pages("Late penalty 10%")).gradeComponents.status, "not_found");
  assert.equal(buildLedger(pages("Attendance 15%")).attendance.status, "not_found");
  assert.equal(buildLedger(pages("Attendance\t15%\nLabs\t85%")).attendance.status, "found");
  assert.equal(buildLedger(pages("Attendance....15%\nLabs....85%")).attendance.status, "found");
});

test("a syllabus with no grade table and no schedule yields no facts", () => {
  const ledger = buildLedger(pages("Welcome to the course. Readings are posted on Canvas."));
  assert.equal(ledger.gradeComponents.status, "not_found");
  assert.equal(ledger.attendance.status, "not_found");
  assert.equal(ledger.schedule.status, "not_found");
});

test("numbered weeks are mapped to the dates printed under them", () => {
  const ledger = buildLedger(pages(SCHEDULE));
  assert.equal(ledger.schedule.status, "found");
  assert.deepEqual(must(ledger.schedule.value).map((w: { week: number }) => w.week), [1, 2, 3]);
  assert.deepEqual(must(ledger.schedule.value)[0].dates, ["9/29", "10/1", "10/2"]);
  assert.deepEqual(must(ledger.schedule.value)[1].dates, ["10/6", "10/8", "10/9"]);
});

test("the common written week headings are recognised", () => {
  for (const heading of ["Week 1: Introduction", "Week 1 - Introduction", "Week 1 \u2013 Introduction", "Week 1. Introduction", "Week 1 (9/29): Introduction", "WEEK 1   Lecture"]) {
    const text = `${heading}\nReading: chapter one\n${heading.replace(/1/, "2")}\nReading: chapter two`;
    assert.equal(buildLedger(pages(text)).schedule.status, "found", heading);
  }
});

test("dates in a later section belong to no week", () => {
  const text = `${SCHEDULE}\nIMPORTANT DATES\nFinal exam 12/8\nDrop deadline 10/20`;
  const weeks = must(buildLedger(pages(text)).schedule.value);
  for (const w of weeks) {
    assert.equal(w.dates.includes("12/8"), false, `week ${w.week} claimed 12/8`);
    assert.equal(w.dates.includes("10/20"), false, `week ${w.week} claimed 10/20`);
  }
});

test("dates on a page that carries no week header belong to no week", () => {
  const ledger = buildLedger(pages(SCHEDULE, "WITHDRAWAL DEADLINES\nProcess a complete drop 9/27\nWithdraw 10/20"));
  for (const w of must(ledger.schedule.value)) {
    assert.equal(w.dates.includes("9/27"), false);
    assert.equal(w.dates.includes("10/20"), false);
  }
});

test("a share of the grade is not read as a date", () => {
  assert.deepEqual(datesIn("The final paper is worth 1/3 of the grade"), []);
  assert.deepEqual(datesIn("Graded out of 2/3 of the total"), []);
  assert.deepEqual(datesIn("Lecture 10/6 and lab 10/9"), ["10/6", "10/9"]);
});

test("a month word is only a date when it is written as one", () => {
  assert.deepEqual(datesIn("may 5 points are added"), []);
  assert.deepEqual(datesIn("Due Sunday, Oct 4 (11:59 pm)"), ["10/4"]);
});

test("a week claim is supported by its own date, its own week number, or its own schedule row", () => {
  const ledger = buildLedger(pages(SCHEDULE));
  assert.equal(weekSupport(ledger, 2, at("2   Lecture   10/6   Antiquarianism   Quiz: Chapter 2   10/8")), "supported");
  assert.equal(weekSupport(ledger, 5, { page: 1, start: 0, text: "Week 5 Lab   10/30" }), "supported"); // names its own week
  assert.equal(weekSupport(ledger, 3, at("Excavation")), "supported"); // a cell under week 3's header
  assert.equal(weekSupport(ledger, 1, at("Excavation")), "contradicted"); // that cell is not under week 1
  assert.equal(weekSupport(ledger, 3, at("2   Lecture   10/6   Antiquarianism")), "contradicted"); // that date is week 2
});

test("a week claim about a passage outside the schedule is left unchecked, not called wrong", () => {
  const ledger = buildLedger(pages(SCHEDULE, "Final exam: 12/8 in the usual room"));
  assert.equal(weekSupport(ledger, 11, { page: 2, start: 0, text: "Final exam: 12/8 in the usual room" }), "unsupported");
  assert.equal(weekSupport(ledger, 11, { page: 2, start: 0, text: "The final exam is cumulative" }), "no_schedule");
});

test("a fraction in a quote does not contradict a week", () => {
  const ledger = buildLedger(pages(SCHEDULE, "The final paper is worth 1/3 of the grade"));
  assert.notEqual(weekSupport(ledger, 2, { page: 2, start: 0, text: "The final paper is worth 1/3 of the grade" }), "contradicted");
});

test("without a printed schedule, week placement is reported as unknown rather than wrong", () => {
  const ledger = buildLedger(pages(GRADE_TABLE));
  assert.equal(weekSupport(ledger, 4, { page: 1, start: 0, text: "Midterm exam" }), "no_schedule");
  assert.equal(weekSupport(ledger, 1.5, { page: 1, start: 0, text: "Midterm exam" }), "unsupported");
});
