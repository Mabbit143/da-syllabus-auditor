import assert from "node:assert/strict";
import { test } from "node:test";
import "../test-support/register-typescript.mjs";
import type { Course } from "../components/TermView";

// @ts-expect-error Native Node TS entry point.
const { representativeFindings } = await import("./departments-packet.ts");

function courseWithFlag(fileName: string, explanation: string, quote: string): Course {
  return {
    id: fileName,
    report: {
      fileName, pageCount: 1, coverage: { status: "full", skipped: [] },
      dimensions: [], flags: [{ kind: "late", severity: "high", explanation, passageId: "p1" }],
      assessments: [], biggestRiskIndex: 0,
      overall: { label: null, reason: "", included: 0, score: 0 },
      passages: [{ id: "p1", page: 3, start: 0, end: quote.length, text: quote }],
    } as never,
  };
}

test("representativeFindings pulls at most one finding per course, capped overall", () => {
  const courses = [
    courseWithFlag("ANTH145.pdf", "Late work gets zero credit.", "No late work accepted under any circumstances."),
    courseWithFlag("ANTH341.pdf", "Late work gets zero credit.", "Late submissions receive a zero, no exceptions."),
  ];
  const findings = representativeFindings(courses);
  assert.equal(findings.length, 2);
  assert.ok(findings.every((f: { quote: string }) => f.quote.length > 0));
});

test("representativeFindings returns nothing for courses with no findings", () => {
  const clean: Course = {
    id: "x", report: {
      fileName: "x.pdf", pageCount: 1, coverage: { status: "full", skipped: [] },
      dimensions: [], flags: [], assessments: [], biggestRiskIndex: null,
      overall: { label: null, reason: "", included: 0, score: 0 }, passages: [],
    } as never,
  };
  assert.deepEqual(representativeFindings([clean]), []);
});

// @ts-expect-error Native Node TS entry point.
const { cleanPacket } = await import("./departments-packet.ts");

test("cleanPacket keeps a letter whose quoted phrases are all real", () => {
  const findings = [{ id: "f1", kind: "flag" as const, label: "x", quote: "No late work accepted under any circumstances.", page: 3, course: "ANTH145.pdf" }];
  const result = cleanPacket({ letter: 'To the ANTH curriculum committee, ANTH145 states "No late work accepted under any circumstances." This is a pattern worth reviewing.' }, findings, null);
  assert.ok(result);
  assert.equal(result!.citedQuotes.length, 1);
});

test("cleanPacket rejects a letter that fabricates a quote", () => {
  const findings = [{ id: "f1", kind: "flag" as const, label: "x", quote: "No late work accepted under any circumstances.", page: 3, course: "ANTH145.pdf" }];
  const result = cleanPacket({ letter: 'ANTH145 states "Students who miss class will be expelled." This is concerning.' }, findings, null);
  assert.equal(result, null);
});

test("cleanPacket rejects a missing or too-short letter", () => {
  assert.equal(cleanPacket({ letter: "too short" }, [], null), null);
  assert.equal(cleanPacket({}, [], null), null);
});
