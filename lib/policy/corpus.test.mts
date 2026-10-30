import assert from "node:assert/strict";
import { test } from "node:test";
import "../../test-support/register-typescript.mjs";
// Node runs this test directly with native TypeScript stripping.
// @ts-expect-error Direct Node execution requires the TypeScript extension.
const { corpusPolicies, usesUoCorpus } = await import("./corpus.ts");
import { readFile } from "node:fs/promises";
import { readdir } from "node:fs/promises";

test("all eleven UO topics retain exact snapshot quotes and original URLs", async () => {
  const topics = ["accommodations", "late_work", "attendance", "academic_integrity", "incompletes", "final_exams", "dead_week", "religious_observance", "grievances", "mandatory_reporting", "withdrawal"] as const;
  const policies = await corpusPolicies(topics);
  assert.deepEqual(policies.map((p) => p.topic), [...topics]);
  const files = await readdir("data/uo-policies");
  const documents = await Promise.all(files.filter((file) => file.endsWith(".md")).map((file) => readFile(`data/uo-policies/${file}`, "utf8")));
  for (const policy of policies) {
    assert.ok(new URL(policy.url).hostname.endsWith(".uoregon.edu"));
    // A topic admitted through the reviewed-OCR pipeline (lib/policy/reviewed-ocr.ts) is
    // sourced from a scanned PDF, not the markdown corpus, and its hash-chain integrity is
    // already covered by reviewed-ocr.test.mts. Only the static-corpus path (lib/policy/
    // corpus.ts SOURCES) is expected to have its quote present in a committed .md file.
    if (policy.provenance) continue;
    assert.ok(documents.some((text) => text.includes(`Source: ${policy.url}`) && text.includes(policy.quote)));
  }
  assert.match(policies.find((p) => p.topic === "incompletes")!.quote, /requests an Incomplete by the published deadline/);
  // academic_integrity now resolves via a reviewed-OCR admission (SOP-Academic-Misconduct-2023.pdf,
  // admitted 2026-10-30) rather than the static corpus.ts snapshot; update this if that admission changes.
  assert.match(policies.find((p) => p.topic === "academic_integrity")!.quote, /grade penalty should not be put in place/);
  assert.match(policies.find((p) => p.topic === "withdrawal")!.quote, /withdrawal deadline each term/);
});

test("school routing excludes Oregon State and supports normalized UO names", async () => {
  assert.equal(usesUoCorpus(" University  of Oregon "), true);
  assert.equal(usesUoCorpus("Oregon State University"), false);
  assert.equal(usesUoCorpus("University of Oregon.example"), false);
  assert.deepEqual(await corpusPolicies([]), []);
});
