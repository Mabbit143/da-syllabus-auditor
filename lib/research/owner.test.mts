import assert from "node:assert/strict";
import { test } from "node:test";
import "../../test-support/register-typescript.mjs";
// @ts-expect-error Native Node TypeScript entry point.
const { verifyResearchOwner } = await import("./owner.ts");

test("user-editable owner claims never grant access", async () => {
  const owner = await verifyResearchOwner("token", {
    auth: { getUser: async () => ({ data: { user: { id: "attacker", user_metadata: { owner: true } } }, error: null }) },
    rpc: async () => ({ data: null, error: { message: "not allowed" } }),
  });
  assert.equal(owner, null);
});

test("verified user and existing owner RPC are both required", async () => {
  const calls: unknown[] = [];
  const owner = await verifyResearchOwner("token", {
    auth: { getUser: async (token) => { calls.push(token); return { data: { user: { id: "owner" } }, error: null }; } },
    rpc: async (name, args) => { calls.push([name, args]); return { data: [], error: null }; },
  });
  assert.equal(owner, "owner");
  assert.deepEqual(calls, ["token", ["gap_report", { threshold: 5 }]]);
});

test("expired tokens stop before owner lookup", async () => {
  let lookup = false;
  const owner = await verifyResearchOwner("expired", {
    auth: { getUser: async () => ({ data: { user: null }, error: new Error("expired") }) },
    rpc: async () => { lookup = true; return { data: [], error: null }; },
  });
  assert.equal(owner, null);
  assert.equal(lookup, false);
});
