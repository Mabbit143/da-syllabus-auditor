import assert from "node:assert/strict";
import { test } from "node:test";
import "../../test-support/register-typescript.mjs";
// @ts-expect-error Native Node TypeScript entry point.
const { createRecordGapsHandler } = await import("./record-gaps-handler.ts");

const pages = [{ pageNumber: 1, text: "Late work is accepted at the instructor's sole discretion without penalty." }];
const agreedItem = {
  topic: "late_work", relation: "conflicts", instructor: "Dr. Example",
  syllabusQuote: "accepted at the instructor's sole discretion without penalty",
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

test("rejects bodies that are not JSON objects", async () => {
  const { post } = handlerWith();
  const response = await post(new Request("https://example.test/api/record-gaps", { method: "POST", headers: { Authorization: "Bearer good-token" }, body: "not json" }));
  assert.equal(response.status, 400);
});
