import test from "node:test";
import assert from "node:assert/strict";
import { runModel, safeProviderCode } from "./model.mjs";

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

test("discovery uses actual Meta search results rather than narrative URLs", async () => {
  const output = await runModel({ mode: "search", instructions: "DISCOVERY", input: "University of Oregon administration" }, {
    creditsVerified: true, provider: "baseten",
    ask: async () => { throw new Error("analysis must not be used"); },
    search: async () => ({ text: "Narrative claims another URL", results: [{ url: "https://example.org/report", snippet: "University of Oregon" }] }),
  });
  assert.equal(output.provider, "meta");
  assert.deepEqual(JSON.parse(output.text), { search_confirmed: true, results: [{ url: "https://example.org/report", snippet: "University of Oregon" }] });
});

test("empty tool evidence is explicitly unconfirmed", async () => {
  const output = await runModel({ mode: "search", instructions: "DISCOVERY", input: "University of Oregon" }, { creditsVerified: true, search: async () => ({ text: "I searched", results: [] }) });
  assert.equal(JSON.parse(output.text).search_confirmed, false);
});

test("provider diagnostics retain status codes without arbitrary error text", () => {
  assert.equal(safeProviderCode(new Error("Meta returned HTTP 429. Usage is limited; retry later.")), "provider_http_429");
  assert.equal(safeProviderCode(new Error("PRIVATE DOCUMENT OR KEY")), "provider_error");
});


test("known unusable provider responses get a safe response diagnostic", async () => {
  for (const message of ["Baseten response had no text output.", "Meta response had no text output.", "Meta response output was invalid.", "Baseten response was invalid."]) {
    assert.equal(safeProviderCode(new Error(message)), "provider_response_invalid");
  }
  await assert.rejects(() => runModel({ instructions: "test", input: "test" }, {
    creditsVerified: true, provider: "baseten", ask: async () => "",
  }), (error) => safeProviderCode(error) === "provider_response_invalid");
  assert.equal(safeProviderCode(new Error("Baseten response was invalid. PRIVATE TEXT")), "provider_error");
});
