import assert from "node:assert/strict";
import { test } from "node:test";
import "../../test-support/register-typescript.mjs";

test("policy endpoint compatibility and required contents isolation", async (t) => {
  // @ts-expect-error Native Node TypeScript entry point.
  const { createPolicyCheckHandler } = await import("./check-handler.ts");
  const context = { term: "fall", year: 2026, level: "undergraduate", coreEducation: "no" };
  const pages = [{ pageNumber: 1, text: "Course objectives and policies are explained in this readable syllabus." }];
  const calls: string[] = [];
  const post = createPolicyCheckHandler({
    local: async () => { calls.push("local"); return []; },
    recheck: async () => [], lookup: async () => [],
    compare: async () => { calls.push("compare"); return []; },
    contents: async (_pages, coverage, ctx) => { calls.push("contents"); return { context: ctx, coverage, groups: [], snapshotDate: "2026-10-27" }; },
  });
  const request = (data: object) => new Request("https://example.test/api/policy-check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ school: "University of Oregon", pages, ...data }) });
  await t.test("old requests keep the five-topic contract", async () => {
    const response = await post(request({}));
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.deepEqual(body.items, []);
    assert.equal(body.requiredContents, undefined);
    assert.ok(calls.includes("compare"));
    assert.ok(!calls.includes("contents"));
  });
  await t.test("malformed context and other schools do not invoke providers", async () => {
    calls.length = 0;
    assert.equal((await post(request({ requiredContentsContext: { ...context, year: "2026" } }))).status, 400);
    assert.equal((await post(request({ school: "Other University", requiredContentsContext: context }))).status, 400);
    assert.deepEqual(calls, []);
  });
  await t.test("contents-only request avoids repeating the original comparison", async () => {
    calls.length = 0;
    const response = await post(request({ requiredContentsContext: context, contentsOnly: true, pageCount: 1, coverage: { status: "full", skipped: [] } }));
    assert.equal(response.status, 200);
    assert.deepEqual(calls, ["contents"]);
    assert.deepEqual((await response.json()).requiredContents.context, context);
  });
  await t.test("missing pages cannot retain full coverage", async () => {
    const response = await post(request({ requiredContentsContext: context, contentsOnly: true, pageCount: 2, coverage: { status: "full", skipped: [] } }));
    assert.equal((await response.json()).requiredContents.coverage.status, "partial");
  });
  await t.test("empty extracted pages cannot retain full coverage", async () => {
    const response = await post(request({ pages: [...pages, { pageNumber: 2, text: " " }], requiredContentsContext: context, contentsOnly: true, pageCount: 2, coverage: { status: "full", skipped: [] } }));
    assert.equal((await response.json()).requiredContents.coverage.status, "partial");
  });
  await t.test("contents failure preserves normal comparison results", async () => {
    const failing = createPolicyCheckHandler({
      local: async () => [], recheck: async () => [], lookup: async () => [],
      compare: async () => [{ topic: "attendance", relation: "silent", schoolQuote: "A verified school policy passage.", schoolUrl: "https://provost.uoregon.edu/test", instructor: null }],
      contents: async () => { throw new Error("synthetic outage"); },
    });
    const response = await failing(request({ requiredContentsContext: context }));
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.items.length, 1);
    assert.match(body.requiredContents.error, /try again|retry/i);
    assert.equal(body.requiredContents.groups.length, 0);
  });
});
