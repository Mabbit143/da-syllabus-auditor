import test from "node:test";
import assert from "node:assert/strict";
import { runModel } from "./model.mjs";

test("credit gate refuses model invocation", async () => {
  let called = false;
  await assert.rejects(() => runModel({ instructions: "test", input: "test" }, { creditsVerified: false, ask: async () => { called = true; } }), /credits/);
  assert.equal(called, false);
});

test("model bridge keeps provider and fallback provenance", async () => {
  const output = await runModel({ instructions: "test", input: "test" }, { creditsVerified: true, provider: "meta", ask: async (_instructions, _input, fallback) => { fallback(); return '{"findings":[]}'; } });
  assert.deepEqual(output, { text: '{"findings":[]}', provider: "baseten", fallback: true });
});

test("malformed requests never reach provider", async () => {
  for (const request of [null, {}, { instructions: "test", input: "x".repeat(100001) }]) {
    await assert.rejects(() => runModel(request, { creditsVerified: true, ask: async () => { throw new Error("should not run"); } }), /request/);
  }
});
