import assert from "node:assert/strict";
import { test } from "node:test";
import "../test-support/register-typescript.mjs";

test("explicit provider selection and upload disclosure", async () => {
  // @ts-expect-error Native Node TS entry point.
  const { analysisProvider, analysisDisclosure } = await import("./providers.ts");
  assert.equal(analysisProvider({}), "meta");
  assert.equal(analysisProvider({ MODEL_PROVIDER: "baseten" }), "baseten");
  assert.throws(() => analysisProvider({ MODEL_PROVIDER: "other" }), /MODEL_PROVIDER/);
  assert.match(analysisDisclosure("baseten"), /Baseten/);
  assert.match(analysisDisclosure("meta"), /Meta/);
});
