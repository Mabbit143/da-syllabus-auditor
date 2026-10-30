import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import "../../test-support/register-typescript.mjs";

test("loadAllEvidence returns records across topics outside PolicyTopic, unfiltered", async () => {
  // @ts-expect-error Native Node TS entry point.
  const { loadAllEvidence } = await import("./evidence.ts");
  const root = await mkdtemp(path.join(tmpdir(), "da-evidence-"));
  const sha = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
  const image = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j8ZkAAAAASUVORK5CYII=", "base64");
  const quote = "Students with holds on their account cannot register until the hold is cleared.";
  const artifact = JSON.stringify({ version: 1, sourceUrl: "https://senate.uoregon.edu/policy.pdf", sourcePdfSha256: "b".repeat(64), pages: [{ page: 1, method: "text", width: 1, height: 1, text: quote, imageSha256: sha(image) }] });
  const record = { version: 1, id: "a".repeat(64), approved: true, selected: true, topic: "registration_holds", sourceUrl: "https://senate.uoregon.edu/policy.pdf", sourcePdfSha256: "b".repeat(64), artifactSha256: sha(artifact), imageSha256: sha(image), page: 1, region: [0, 0, 1, 1], quote, extractionMethod: "text", reviewedAt: "2026-10-30T00:00:00Z" };
  try {
    await mkdir(path.join(root, "artifacts"));
    await writeFile(path.join(root, "artifacts", `${sha(artifact)}.json`), artifact);
    await writeFile(path.join(root, "artifacts", `${sha(image)}.png`), image);
    await writeFile(path.join(root, "index.json"), JSON.stringify({ version: 1, records: [record] }));
    const evidence = await loadAllEvidence(root);
    assert.equal(evidence.length, 1);
    assert.equal(evidence[0].topic.id, "registration_holds");
    assert.equal(evidence[0].topic.label, "Registration holds");
    assert.equal(evidence[0].quote, quote);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("an unapproved record is excluded, but an admitted-and-unselected one still shows (selection only gates the live syllabus-audit source)", async () => {
  // @ts-expect-error Native Node TS entry point.
  const { loadAllEvidence } = await import("./evidence.ts");
  const root = await mkdtemp(path.join(tmpdir(), "da-evidence-"));
  const sha = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
  const image = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j8ZkAAAAASUVORK5CYII=", "base64");
  const quote = "Students with holds on their account cannot register until the hold is cleared.";
  const artifact = JSON.stringify({ version: 1, sourceUrl: "https://senate.uoregon.edu/policy.pdf", sourcePdfSha256: "b".repeat(64), pages: [{ page: 1, method: "text", width: 1, height: 1, text: quote, imageSha256: sha(image) }] });
  const approvedUnselected = { version: 1, id: "a".repeat(64), approved: true, selected: false, topic: "registration_holds", sourceUrl: "https://senate.uoregon.edu/policy.pdf", sourcePdfSha256: "b".repeat(64), artifactSha256: sha(artifact), imageSha256: sha(image), page: 1, region: [0, 0, 1, 1], quote, extractionMethod: "text", reviewedAt: "2026-10-30T00:00:00Z" };
  const unapproved = { ...approvedUnselected, id: "c".repeat(64), approved: false };
  try {
    await mkdir(path.join(root, "artifacts"));
    await writeFile(path.join(root, "artifacts", `${sha(artifact)}.json`), artifact);
    await writeFile(path.join(root, "artifacts", `${sha(image)}.png`), image);
    await writeFile(path.join(root, "index.json"), JSON.stringify({ version: 1, records: [approvedUnselected, unapproved] }));
    const evidence = await loadAllEvidence(root);
    assert.equal(evidence.length, 1);
    assert.equal(evidence[0].topic.id, "registration_holds");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("an unknown topic id still renders, falling back to its raw id as the label", async () => {
  // @ts-expect-error Native Node TS entry point.
  const { topicInfo } = await import("./evidence.ts");
  const info = topicInfo("not_yet_registered_topic");
  assert.equal(info.id, "not_yet_registered_topic");
  assert.equal(info.label, "not_yet_registered_topic");
  assert.equal(info.syllabusComparable, false);
});
