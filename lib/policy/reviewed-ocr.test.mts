import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import "../../test-support/register-typescript.mjs";

test("only selected, approved, unchanged documentary evidence enters lookup", async () => {
  // @ts-expect-error Native Node TS entry point.
  const { loadReviewedPolicies } = await import("./reviewed-ocr.ts");
  const root = await mkdtemp(path.join(tmpdir(), "da-reviewed-"));
  const sha = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
  const image = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j8ZkAAAAASUVORK5CYII=", "base64");
  const quote = "Students must be told the attendance requirements and how absences affect grades.";
  const artifact = JSON.stringify({ version: 1, sourceUrl: "https://provost.uoregon.edu/policy.pdf", sourcePdfSha256: "b".repeat(64), pages: [{ page: 1, method: "ocr", width: 1, height: 1, text: quote, imageSha256: sha(image) }] });
  const record = { version: 1, id: "a".repeat(64), approved: true, selected: true, topic: "attendance", sourceUrl: "https://provost.uoregon.edu/policy.pdf", sourcePdfSha256: "b".repeat(64), artifactSha256: sha(artifact), imageSha256: sha(image), page: 1, region: [0, 0, 1, 1], quote, extractionMethod: "ocr", reviewedAt: "2026-10-27T00:00:00Z" };
  const index = (records: unknown[]) => writeFile(path.join(root, "index.json"), JSON.stringify({ version: 1, records }));
  try {
    await mkdir(path.join(root, "artifacts"));
    await writeFile(path.join(root, "artifacts", `${sha(artifact)}.json`), artifact);
    await writeFile(path.join(root, "artifacts", `${sha(image)}.png`), image);
    await index([record]);
    const policies = await loadReviewedPolicies(["attendance"], root);
    assert.equal(policies.length, 1);
    assert.equal(policies[0].quote, quote);
    assert.equal(policies[0].provenance?.page, 1);
    assert.ok(policies[0].url.endsWith("#page=1"));
    for (const changed of [{ approved: false }, { selected: false }, { artifactSha256: "../escape" }, { quote: "Completely fabricated policy passage with no documentary support." }, { sourceUrl: "https://evil.test/a.pdf" }, { region: [0, 0, 5, 5] }]) {
      await index([{ ...record, ...changed }]);
      assert.equal((await loadReviewedPolicies(["attendance"], root)).length, 0);
    }
    await index([record]);
    await writeFile(path.join(root, "artifacts", `${sha(artifact)}.json`), artifact + "changed");
    assert.equal((await loadReviewedPolicies(["attendance"], root)).length, 0);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("client-supplied OCR metadata cannot authorize a cached quote", async () => {
  // @ts-expect-error Native Node TS entry point.
  const { recheckPolicies } = await import("./lookup.ts");
  const original = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("Unapproved cache must not fetch"); };
  try {
    const forged = { topic: "attendance" as const, url: "https://provost.uoregon.edu/fake.pdf#page=1", quote: "A fabricated quote of sufficient length to look like policy.", provenance: { method: "reviewed_ocr" as const, page: 1, region: [0, 0, 1, 1] as [number, number, number, number], sourcePdfSha256: "a".repeat(64), artifactSha256: "b".repeat(64), imageSha256: "c".repeat(64), reviewedAt: "2026-10-27T00:00:00Z", extractionMethod: "ocr" as const } };
    assert.deepEqual(await recheckPolicies("University of Oregon", [forged]), []);
  } finally { globalThis.fetch = original; }
});
