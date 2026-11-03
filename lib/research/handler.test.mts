import assert from "node:assert/strict";
import { test } from "node:test";
import "../../test-support/register-typescript.mjs";
// @ts-expect-error Native Node TypeScript entry point.
const { createResearchHandlers } = await import("./handler.ts");

function setup(owner: string | null = "owner-id") {
  const calls: Record<string, unknown>[] = [];
  const handlers = createResearchHandlers({
    owner: async (token) => token === "valid" ? owner : null,
    query: async (request) => { calls.push(request); return { documents: [] }; },
  });
  return { ...handlers, calls };
}

test("anonymous and non-owner requests never reach research storage", async () => {
  for (const token of [null, "valid"]) {
    const h = setup(null);
    const response = await h.GET(new Request("https://example.test/api/research", { headers: token ? { authorization: `Bearer ${token}` } : {} }));
    assert.equal(response.status, token ? 403 : 401);
    assert.equal(h.calls.length, 0);
    assert.match(response.headers.get("cache-control")!, /no-store/);
  }
});

test("owner reads validate source windows and pagination", async () => {
  const h = setup();
  const response = await h.GET(new Request("https://example.test/api/research?version=12&start=30", { headers: { authorization: "Bearer valid" } }));
  assert.equal(response.status, 200);
  assert.deepEqual(h.calls[0], { action: "document", version_id: 12, start: 30 });
  const bad = await h.GET(new Request("https://example.test/api/research?version=../../private", { headers: { authorization: "Bearer valid" } }));
  assert.equal(bad.status, 400);
  assert.equal(h.calls.length, 1);
});

test("review actor comes from verified owner, never request body", async () => {
  const h = setup();
  const response = await h.POST(new Request("https://example.test/api/research", {
    method: "POST", headers: { authorization: "Bearer valid", "content-type": "application/json" },
    body: JSON.stringify({ report_id: 2, finding_id: "f1", status: "follow_up", note: "Check applicable policy date.", actor: "forged-user" }),
  }));
  assert.equal(response.status, 200);
  assert.equal(h.calls[0].actor, "owner-id");
});

test("large workbook windows remain accessible with a bounded offset", async () => {
  const h = setup();
  const headers = { authorization: "Bearer valid" };
  const valid = await h.GET(new Request("https://example.test/api/research?version=12&start=2100000", { headers }));
  assert.equal(valid.status, 200);
  const invalid = await h.GET(new Request("https://example.test/api/research?version=12&start=4000001", { headers }));
  assert.equal(invalid.status, 400);
  assert.equal(h.calls.length, 1);
});

test("invalid reviews and broken storage return readable errors", async () => {
  const h = setup();
  const response = await h.POST(new Request("https://example.test/api/research", {
    method: "POST", headers: { authorization: "Bearer valid" }, body: JSON.stringify({ report_id: 1, finding_id: "f1", status: "public", note: "" }),
  }));
  assert.equal(response.status, 400);
  assert.equal(h.calls.length, 0);
  const broken = createResearchHandlers({ owner: async () => "owner", query: async () => { throw new Error("private filesystem path"); } });
  const failed = await broken.GET(new Request("https://example.test/api/research", { headers: { authorization: "Bearer valid" } }));
  assert.equal(failed.status, 503);
  assert.doesNotMatch(await failed.text(), /private filesystem/);
});
