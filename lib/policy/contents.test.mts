import assert from "node:assert/strict";
import { test } from "node:test";
import "../../test-support/register-typescript.mjs";

test("required contents evidence, applicability and coverage", async (t) => {
  // @ts-expect-error Native Node TypeScript entry point.
  const { checkRequiredContents, parseCourseContext } = await import("./contents.ts");
  const context = { term: "fall", year: 2026, level: "undergraduate", coreEducation: "no" } as const;
  const coverage = { status: "full", skipped: [] } as const;
  const pages = [{ pageNumber: 1, text: "Professor Robin teaches this course. Office hours are Monday at noon. See the external rubric for grading criteria." }];
  const ask = async () => JSON.stringify({ candidates: [
    { id: "instructor_name", page: 1, quote: "Professor Robin teaches this course.", kind: "content" },
    { id: "office_hours", page: 1, quote: "Office hours are Monday at noon.", kind: "content" },
    { id: "grade_criteria", page: 1, quote: "See the external rubric for grading criteria.", kind: "reference" },
    { id: "office_room", page: 1, quote: "Office room 999 does not exist.", kind: "content" },
    { id: "uo_email", page: 2, quote: "Professor Robin teaches this course.", kind: "content" },
    { id: "invented_id", page: 1, quote: "Professor Robin teaches this course.", kind: "content" },
  ] });
  const result = await checkRequiredContents(pages, coverage, context, ask);
  const component = (id: string) => result.groups.flatMap((g: { components: { id: string; status: string; applicability: string; passages: { text: string; page: number; start: number; end: number }[] }[] }) => g.components).find((c: { id: string }) => c.id === id)!;
  await t.test("retains canonical evidence, not whole-group fulfillment", () => {
    assert.equal(result.groups.length, 8);
    assert.equal(component("instructor_name").status, "found");
    assert.equal(component("office_room").status, "not_assessed");
    assert.equal(component("uo_email").status, "not_assessed");
    assert.equal(component("office_appointment").status, "not_assessed");
    const p = component("office_hours").passages[0];
    assert.equal(pages[0].text.slice(p.start, p.end), p.text);
    assert.equal(component("grade_criteria").status, "needs_review");
    assert.equal(component("core_education").status, "not_applicable");
  });
  await t.test("rejects ambiguous quotes", async () => {
    const r = await checkRequiredContents([{ pageNumber: 1, text: pages[0].text + " " + pages[0].text }], coverage, context, ask);
    assert.equal(r.groups[0].components[0].status, "not_assessed");
  });
  await t.test("historical statement is excluded and unknown context stays explicit", async () => {
    const historical = await checkRequiredContents(pages, coverage, { ...context, year: 2025 }, ask);
    assert.equal(historical.groups.at(-1)!.components[0].status, "not_applicable");
    assert.equal(historical.groups[0].components[0].applicability, "historical_unverified");
    const unknown = await checkRequiredContents(pages, coverage, { term: "unknown", year: null, level: "unknown", coreEducation: "unknown" }, ask);
    assert.equal(unknown.groups[0].components[0].applicability, "unknown");
    assert.equal(unknown.groups[2].components.at(-1)!.status, "not_assessed");
  });
  await t.test("requires the complete standard statement, including across page boundaries", async () => {
    const statement = result.groups.at(-1)!.components[0].standardText;
    assert.ok(statement && statement.length > 500);
    const split = statement.indexOf("Students with disabilities");
    const full = await checkRequiredContents([{ pageNumber: 1, text: statement.slice(0, split) }, { pageNumber: 2, text: statement.slice(split) }], coverage, context, async () => '{"candidates":[]}');
    assert.equal(full.groups.at(-1)!.components[0].status, "found");
    assert.equal(full.groups.at(-1)!.components[0].passages.length, 2);
    const partial = await checkRequiredContents([{ pageNumber: 1, text: statement.slice(0, split) }], coverage, context, async () => JSON.stringify({ candidates: [{ id: "university_statement", page: 1, quote: statement.slice(0, 100), kind: "content" }] }));
    assert.equal(partial.groups.at(-1)!.components[0].status, "needs_review");
  });
  await t.test("processes late text without truncation and discloses failures", async () => {
    let calls = 0;
    let sawEnd = false;
    const large = [{ pageNumber: 1, text: "x".repeat(65000) + " End of syllabus marker." }];
    const r = await checkRequiredContents(large, { status: "partial", skipped: ["unreadable page 2"] }, context, async (_instructions: string, input: string) => {
      calls++;
      sawEnd ||= input.includes("End of syllabus marker.");
      if (calls === 1) throw new Error("synthetic provider outage");
      return '{"candidates":[]}';
    });
    assert.ok(calls > 1);
    assert.ok(sawEnd);
    assert.equal(r.coverage.status, "partial");
    assert.ok(r.coverage.skipped.length >= 2);
    assert.ok(r.error);
    assert.ok(r.groups.flatMap((g: { components: { status: string }[] }) => g.components).every((c: { status: string }) => ["not_assessed", "not_applicable"].includes(c.status)));
  });
  await t.test("rejects malformed course context", () => {
    assert.equal(parseCourseContext({ ...context, year: "2026" }), null);
    assert.equal(parseCourseContext({ ...context, level: "doctor" }), null);
    assert.equal(parseCourseContext({ ...context, term: ["fall"] }), null);
    assert.deepEqual(parseCourseContext(context), context);
  });
  await t.test("graduate policy citations do not include undergraduate-only obligations", async () => {
    const grad = await checkRequiredContents(pages, coverage, { ...context, level: "graduate" }, ask);
    const objectives = grad.groups.find((g) => g.id === "objectives")!.components[0];
    assert.ok(!objectives.policyQuote.includes("Core Education"));
    const absence = grad.groups.find((g) => g.id === "absences")!.components[0];
    assert.ok(!absence.policyQuote.includes("for undergraduate courses"));
  });
  await t.test("never assembles a complete statement across a missing page", async () => {
    const statement = result.groups.at(-1)!.components[0].standardText!;
    const split = statement.indexOf("Students with disabilities");
    const r = await checkRequiredContents([{ pageNumber: 1, text: statement.slice(0, split) }, { pageNumber: 3, text: statement.slice(split) }], { status: "partial", skipped: ["Page 2 is missing"] }, context, async () => '{"candidates":[]}');
    assert.equal(r.groups.at(-1)!.components[0].status, "not_assessed");
    const blank = await checkRequiredContents([{ pageNumber: 1, text: statement.slice(0, split) }, { pageNumber: 2, text: " " }, { pageNumber: 3, text: statement.slice(split) }], coverage, context, async () => '{"candidates":[]}');
    assert.equal(blank.groups.at(-1)!.components[0].status, "not_assessed");
    assert.equal(blank.coverage.status, "partial");
  });
  await t.test("a bare external rubric URL is review evidence, never found criteria", async () => {
    const quote = "Grading rubric: https://canvas.uoregon.edu/rubric";
    const r = await checkRequiredContents([{ pageNumber: 1, text: quote }], coverage, context, async () => JSON.stringify({ candidates: [{ id: "grade_criteria", page: 1, quote, kind: "content" }] }));
    assert.equal(r.groups.find((g) => g.id === "grading")!.components.find((c) => c.id === "grade_criteria")!.status, "needs_review");
    const canvas = "The grading rubric is on Canvas.";
    const referred = await checkRequiredContents([{ pageNumber: 1, text: canvas }], coverage, context, async () => JSON.stringify({ candidates: [{ id: "grade_criteria", page: 1, quote: canvas, kind: "content" }] }));
    assert.equal(referred.groups.find((g) => g.id === "grading")!.components.find((c) => c.id === "grade_criteria")!.status, "needs_review");
    const totalOnly = "Grading rubric (100 points): https://canvas.uoregon.edu/rubric";
    const total = await checkRequiredContents([{ pageNumber: 1, text: totalOnly }], coverage, context, async () => JSON.stringify({ candidates: [{ id: "grade_criteria", page: 1, quote: totalOnly, kind: "content" }] }));
    assert.equal(total.groups.find((g) => g.id === "grading")!.components.find((c) => c.id === "grade_criteria")!.status, "needs_review");
    const actual = "Essays are graded on clarity and evidence; resources: https://canvas.uoregon.edu/rubric";
    const criteria = await checkRequiredContents([{ pageNumber: 1, text: actual }], coverage, context, async () => JSON.stringify({ candidates: [{ id: "grade_criteria", page: 1, quote: actual, kind: "content" }] }));
    assert.equal(criteria.groups.find((g) => g.id === "grading")!.components.find((c) => c.id === "grade_criteria")!.status, "found");
  });
  await t.test("stops calls before the route budget and returns partial progress with page locators", async () => {
    let now = 0;
    let calls = 0;
    const longPages = Array.from({ length: 6 }, (_, index) => ({ pageNumber: index + 1, text: "Course text. ".repeat(1200) }));
    longPages[0].text += " Office hours are Monday at noon.";
    const r = await checkRequiredContents(longPages, coverage, context, async () => {
      calls++; now += 55_000;
      return JSON.stringify({ candidates: [{ id: "office_hours", page: 1, quote: "Office hours are Monday at noon.", kind: "content" }] });
    }, { now: () => now, deadline: 240_000 });
    assert.equal(calls, 4);
    assert.equal(r.coverage.status, "partial");
    assert.ok(r.coverage.skipped.some((s) => /pages? 5/.test(s)));
    assert.ok(r.coverage.skipped.some((s) => /pages? 6/.test(s)));
    assert.equal(r.groups.find((g) => g.id === "office")!.components[0].status, "found");
    now = 0;
    calls = 0;
    await checkRequiredContents(longPages, coverage, context, async () => {
      calls++; now += 90_000;
      return '{"candidates":[]}';
    }, { now: () => now, deadline: 240_000, callBudgetMs: 115_000 });
    assert.equal(calls, 2);
  });
});
