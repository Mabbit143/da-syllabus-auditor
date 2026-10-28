import assert from "node:assert/strict";
import { test } from "node:test";
import "../test-support/register-typescript.mjs";

test("provider transports route once and reject unsafe responses", async (t) => {
  // @ts-expect-error Native Node TS entry point.
  const { callMeta, callMetaSearch, runAgent } = await import("./meta.ts");
  const original = globalThis.fetch;
  const saved = { ...process.env };
  const requests: { url: string; body: Record<string, unknown> }[] = [];
  process.env.MODEL_PROVIDER = "baseten";
  process.env.MODEL_API_KEY = "synthetic-meta";
  process.env.BASETEN_API_KEY = "synthetic-baseten";
  try {
    await t.test("Baseten analyzes; Meta searches with store false", async () => {
      globalThis.fetch = async (url, options) => {
        requests.push({ url: String(url), body: JSON.parse(String(options?.body)) });
        return Response.json(String(url).includes("baseten") ? { choices: [{ message: { role: "assistant", content: "analysis" } }] } : { output: [{ type: "message", content: [{ type: "output_text", text: "research" }] }] });
      };
      assert.equal(await callMeta("instructions", "synthetic input"), "analysis");
      assert.equal((await callMetaSearch("instructions", "public query")).text, "research");
      assert.equal(requests.length, 2);
      assert.equal(requests[0].body.model, "meta-models/muse-spark-open");
      assert.ok(requests[1].url.startsWith("https://api.meta.ai/"));
      assert.equal(requests[1].body.store, false);
    });
    await t.test("quota errors exclude response bodies and do not fall back", async () => {
      let calls = 0;
      globalThis.fetch = async () => { calls++; return new Response("PRIVATE-KEY-AND-SYLLABUS", { status: 429 }); };
      await assert.rejects(callMeta("x", "y"), (error: Error) => !error.message.includes("PRIVATE") && error.message.includes("429"));
      assert.equal(calls, 1);
    });
    await t.test("reject malformed text and tools without invoking tools", async () => {
      globalThis.fetch = async () => Response.json({ choices: [{ message: { content: { secret: "bad" } } }] });
      await assert.rejects(callMeta("x", "y"), /response|text/i);
      globalThis.fetch = async () => Response.json({ choices: [{ message: { tool_calls: [{ id: "a", function: { name: 3, arguments: {} } }] } }] });
      await assert.rejects(runAgent("x", "y", [], () => { throw new Error("must not execute"); }), /response|tool/i);
    });
    await t.test("missing keys fail before fetch", async () => {
      delete process.env.BASETEN_API_KEY;
      globalThis.fetch = async () => { throw new Error("unexpected fetch"); };
      await assert.rejects(callMeta("x", "y"), /BASETEN_API_KEY/);
    });
  } finally {
    globalThis.fetch = original;
    for (const name of Object.keys(process.env)) if (!(name in saved)) delete process.env[name];
    Object.assign(process.env, saved);
  }
});

test("a failed Meta call is retried on Baseten only when a key is set, and says so", async () => {
  // @ts-expect-error Native Node TS entry point.
  const { callMeta } = await import("./meta.ts");
  const original = globalThis.fetch;
  const saved = { ...process.env };
  process.env.MODEL_PROVIDER = "meta";
  process.env.MODEL_API_KEY = "synthetic-meta";
  process.env.BASETEN_API_KEY = "synthetic-baseten";
  const urls: string[] = [];
  globalThis.fetch = async (url) => {
    urls.push(String(url));
    return String(url).includes("baseten") ? Response.json({ choices: [{ message: { role: "assistant", content: "from baseten" } }] }) : new Response("no", { status: 500 });
  };
  try {
    let told = 0;
    assert.equal(await callMeta("x", "y", () => { told++; }), "from baseten");
    assert.equal(told, 1);
    assert.ok(urls[0].startsWith("https://api.meta.ai/") && urls[1].includes("baseten"));
    delete process.env.BASETEN_API_KEY;
    await assert.rejects(callMeta("x", "y"), /Meta returned HTTP 500/);
  } finally {
    globalThis.fetch = original;
    for (const name of Object.keys(process.env)) if (!(name in saved)) delete process.env[name];
    Object.assign(process.env, saved);
  }
});
