import assert from "node:assert/strict";
import { test } from "node:test";
import "../../test-support/register-typescript.mjs";
// @ts-expect-error Native Node TypeScript entry point.
const { createRecordGapsHandler } = await import("./record-gaps-handler.ts");

const pages = [{ pageNumber: 1, text: "Late work is accepted at the instructor's sole discretion without penalty. Readings are posted on the course site each Monday." }];
const agreedItem = {
  topic: "late_work", relation: "conflicts", instructor: "Dr. Example",
  syllabusQuote: "Late work is accepted at the instructor's sole discretion without penalty",
  syllabusPage: 1, schoolQuote: "Every course syllabus shall outline how to handle work turned in after the deadline.",
  schoolUrl: "https://provost.uoregon.edu/undergraduate-course-attendance-and-engagement-policy",
};

function handlerWith(overrides: Partial<Parameters<typeof createRecordGapsHandler>[0]> = {}) {
  const inserted: unknown[] = [];
  const post = createRecordGapsHandler({
    authenticate: async (token) => (token === "good-token" ? "user-1" : null),
    verifySchoolQuote: async () => true,
    insert: async (rows) => { inserted.push(...rows); },
    ...overrides,
  });
  return { post, inserted };
}

function request(body: object, token: string | null = "good-token"): Request {
  return new Request("https://example.test/api/record-gaps", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
}

test("rejects a request with no valid session", async () => {
  const { post, inserted } = handlerWith();
  const response = await post(request({ school: "University of Oregon", pages, items: [agreedItem] }, "bad-token"));
  assert.equal(response.status, 401);
  assert.deepEqual(inserted, []);
});

test("rejects a request with no bearer token at all", async () => {
  const { post, inserted } = handlerWith();
  const response = await post(request({ school: "University of Oregon", pages, items: [agreedItem] }, null));
  assert.equal(response.status, 401);
  assert.deepEqual(inserted, []);
});

test("records an agreed finding whose syllabus quote verifies and whose school quote still verifies live", async () => {
  const { post, inserted } = handlerWith();
  const response = await post(request({ school: "University of Oregon", pages, items: [agreedItem] }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { recorded: 1 });
  assert.equal(inserted.length, 1);
  assert.equal((inserted[0] as { topic: string }).topic, "late_work");
});

test("drops a finding whose claimed syllabus quote is not actually on the page (forged by the client)", async () => {
  const { post, inserted } = handlerWith();
  const forged = { ...agreedItem, syllabusQuote: "something the syllabus never actually says" };
  const response = await post(request({ school: "University of Oregon", pages, items: [forged] }));
  assert.deepEqual(await response.json(), { recorded: 0 });
  assert.deepEqual(inserted, []);
});

test("drops a finding whose school quote no longer verifies against the live page", async () => {
  const { post, inserted } = handlerWith({ verifySchoolQuote: async () => false });
  const response = await post(request({ school: "University of Oregon", pages, items: [agreedItem] }));
  assert.deepEqual(await response.json(), { recorded: 0 });
  assert.deepEqual(inserted, []);
});

test("never records a 'matches' or 'disputed' relation, even if the client sends one", async () => {
  const { post, inserted } = handlerWith();
  const matches = { ...agreedItem, relation: "matches" };
  const disputed = { ...agreedItem, relation: "disputed" };
  await post(request({ school: "University of Oregon", pages, items: [matches, disputed] }));
  assert.deepEqual(inserted, []);
});

test("rejects an unknown policy topic instead of trusting an arbitrary string", async () => {
  const { post, inserted } = handlerWith();
  const forged = { ...agreedItem, topic: "something_made_up" };
  await post(request({ school: "University of Oregon", pages, items: [forged] }));
  assert.deepEqual(inserted, []);
});

test("caps the number of findings per request", async () => {
  const { post } = handlerWith();
  const many = Array.from({ length: 25 }, () => agreedItem);
  const response = await post(request({ school: "University of Oregon", pages, items: many }));
  assert.equal(response.status, 400);
});

test("rejects a missing or too-short school name", async () => {
  const { post } = handlerWith();
  const response = await post(request({ school: "UO", pages, items: [agreedItem] }));
  assert.equal(response.status, 400);
});

test("rejects malformed pages", async () => {
  const { post } = handlerWith();
  const response = await post(request({ school: "University of Oregon", pages: [{ pageNumber: 0, text: "x" }], items: [agreedItem] }));
  assert.equal(response.status, 400);
});

// Synthetic fixtures only: invented text and names, never a real syllabus or instructor.
const silentItem = {
  topic: "late_work", relation: "silent",
  schoolQuote: "Every course syllabus shall outline how to handle work turned in after the deadline.",
  schoolUrl: "https://provost.uoregon.edu/undergraduate-course-attendance-and-engagement-policy",
};

test("drops a 'silent' finding when the submitted pages do mention the topic", async () => {
  const { post, inserted } = handlerWith();
  const mentioned = [{ pageNumber: 1, text: "Assignments handed in late lose ten percent per day." }];
  const response = await post(request({ school: "university of oregon", pages: mentioned, items: [silentItem] }));
  assert.deepEqual(await response.json(), { recorded: 0 });
  assert.deepEqual(inserted, []);
});

test("records a 'silent' finding when the submitted pages never mention the topic", async () => {
  const { post, inserted } = handlerWith();
  const unrelated = [{ pageNumber: 1, text: "Readings are posted on the course site each Monday." }];
  const response = await post(request({ school: "university of oregon", pages: unrelated, items: [silentItem] }));
  assert.deepEqual(await response.json(), { recorded: 1 });
  assert.equal((inserted[0] as { kind: string }).kind, "silent");
});

test("stores the instructor as null when the name is not in the submitted pages, and keeps the finding", async () => {
  const { post, inserted } = handlerWith();
  const fabricated = { ...agreedItem, instructor: "Prof. Nobody Invented" };
  const response = await post(request({ school: "university of oregon", pages, items: [fabricated] }));
  assert.deepEqual(await response.json(), { recorded: 1 });
  assert.equal((inserted[0] as { instructor: string | null }).instructor, null);
});

test("keeps the instructor name when it appears in the pages, ignoring case and line-wrap whitespace", async () => {
  const { post, inserted } = handlerWith();
  const named = [{ pageNumber: 1, text: `Instructor: Dr. Sample\nPerson\n${pages[0].text}` }];
  const item = { ...agreedItem, instructor: "dr. sample person" };
  const response = await post(request({ school: "university of oregon", pages: named, items: [item] }));
  assert.deepEqual(await response.json(), { recorded: 1 });
  assert.equal((inserted[0] as { instructor: string | null }).instructor, "dr. sample person");
});

// Non-silent findings must carry their own evidence, checked the same way compare.ts checks it.
// Each case changes only the syllabus evidence of agreedItem (which records) so only one guard can reject it.
test("drops a non-silent finding that sends no syllabus quote at all", async () => {
  const { post, inserted } = handlerWith();
  const noQuote: Record<string, unknown> = { ...agreedItem };
  delete noQuote.syllabusQuote;
  delete noQuote.syllabusPage;
  const response = await post(request({ school: "university of oregon", pages, items: [noQuote] }));
  assert.deepEqual(await response.json(), { recorded: 0 });
  assert.deepEqual(inserted, []);
});

test("drops a non-silent finding whose verified syllabus quote is not about the topic", async () => {
  const { post, inserted } = handlerWith();
  const offTopic = { ...agreedItem, syllabusQuote: "Readings are posted on the course site each Monday" };
  const response = await post(request({ school: "university of oregon", pages, items: [offTopic] }));
  assert.deepEqual(await response.json(), { recorded: 0 });
  assert.deepEqual(inserted, []);
});

test("stores the syllabus quote as verified on the page, not the client's copy", async () => {
  const { post, inserted } = handlerWith();
  const respaced = { ...agreedItem, syllabusQuote: "  Late   work is accepted at the\ninstructor's sole discretion without penalty " };
  const response = await post(request({ school: "university of oregon", pages, items: [respaced] }));
  assert.deepEqual(await response.json(), { recorded: 1 });
  const row = inserted[0] as { syllabus_quote: string | null; syllabus_page: number | null };
  assert.equal(row.syllabus_quote, "Late work is accepted at the instructor's sole discretion without penalty");
  assert.equal(row.syllabus_page, 1);
});

test("rejects bodies that are not JSON objects", async () => {
  const { post } = handlerWith();
  const response = await post(new Request("https://example.test/api/record-gaps", { method: "POST", headers: { Authorization: "Bearer good-token" }, body: "not json" }));
  assert.equal(response.status, 400);
});
