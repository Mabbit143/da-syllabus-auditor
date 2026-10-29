import assert from "node:assert/strict";
import { test } from "node:test";
import "../../test-support/register-typescript.mjs";

const quote = "Late assignments are handled on a case-by-case basis.";
const pages = [{ pageNumber: 1, text: `Course policies. ${quote} Attendance is not graded.` }];
const policies = [
  { topic: "late_work", url: "https://policies.uoregon.edu/a", quote: "Every syllabus shall outline how to handle late work." },
  { topic: "attendance", url: "https://policies.uoregon.edu/b", quote: "Absence policies should be reason-neutral." },
];
const answer = (late: string, attendance: string) => async () => JSON.stringify({
  instructor: { name: "", page: 1, quote: "" },
  comparisons: [
    { topic: "late_work", relation: late, syllabusPage: late === "silent" ? 0 : 1, syllabusQuote: late === "silent" ? "" : quote },
    { topic: "attendance", relation: attendance, syllabusPage: attendance === "silent" ? 0 : 1, syllabusQuote: attendance === "silent" ? "" : "Attendance is not graded." },
  ],
});

async function agreed(first: () => Promise<string>, second?: () => Promise<string>) {
  // @ts-expect-error Native Node TS entry point.
  const { comparePoliciesAgreed } = await import("./compare.ts");
  return comparePoliciesAgreed(pages, policies as never, first, second) as Promise<{ topic: string; relation: string; syllabusQuote?: string }[]>;
}

test("a verdict is shown only where both models agree", async () => {
  const r = await agreed(answer("matches", "matches"), answer("matches", "adds_requirement"));
  assert.equal(r.find((c) => c.topic === "late_work")?.relation, "matches");
  assert.equal(r.find((c) => c.topic === "attendance")?.relation, "disputed");
  assert.equal(r.find((c) => c.topic === "attendance")?.syllabusQuote, "Attendance is not graded."); // the evidence is still shown
});

test("a topic only one model could verify is disputed, not decided", async () => {
  const onlyLate = async () => JSON.stringify({ instructor: { name: "", page: 1, quote: "" }, comparisons: [{ topic: "late_work", relation: "matches", syllabusPage: 1, syllabusQuote: quote }] });
  const r = await agreed(answer("matches", "matches"), onlyLate);
  assert.equal(r.find((c) => c.topic === "late_work")?.relation, "matches");
  assert.equal(r.find((c) => c.topic === "attendance")?.relation, "disputed");
});

test("if the second model fails, the first model's result stands alone", async () => {
  const r = await agreed(answer("matches", "adds_requirement"), async () => { throw new Error("baseten down"); });
  assert.deepEqual(r.map((c) => c.relation), ["matches", "adds_requirement"]);
});

test("a quote that is not about the topic is not evidence for it", async () => {
  // @ts-expect-error Native Node TS entry point.
  const { comparePolicies } = await import("./compare.ts");
  const integrity = [{ topic: "academic_integrity", url: "https://policies.uoregon.edu/c", quote: "Students are prohibited from committing academic misconduct." }];
  const offTopic = "You are prohibited from posting course material on websites.";
  const ask = async () => JSON.stringify({ instructor: { name: "", page: 1, quote: "" }, comparisons: [{ topic: "academic_integrity", relation: "adds_requirement", syllabusPage: 1, syllabusQuote: offTopic }] });
  const silent = await comparePolicies([{ pageNumber: 1, text: `Rules. ${offTopic}` }], integrity as never, ask);
  assert.deepEqual(silent.map((c: { relation: string }) => c.relation), ["silent"]); // topic never mentioned: silence, not a mismatch
  const mentioned = await comparePolicies([{ pageNumber: 1, text: `Rules. ${offTopic} Plagiarism is cheating.` }], integrity as never, ask);
  assert.equal(mentioned.length, 0); // topic is mentioned elsewhere: the wrong quote is dropped, no silence claimed
});

test("without a second model nothing is disputed", async () => {
  const r = await agreed(answer("matches", "matches"));
  assert.deepEqual(r.map((c) => c.relation), ["matches", "matches"]);
});
