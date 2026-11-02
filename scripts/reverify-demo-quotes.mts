// Recording-day re-verification of the UO policy quotes the demo cites.
//
// The demo quotes live in committed snapshots (fetched 2026-10-27), so a snapshot
// match is a claim about the capture date, not about today. Run this on the morning
// of the recording (`npm run verify:quotes`) to re-fetch every live page and confirm
// the same passage still appears. Reviewed-OCR topics (a campus PDF) are checked by
// comparing the download's sha256 against the admitted source-PDF hash; if the file
// changed, the quote must be re-checked by hand in the reviewed artifact.
// No passing exit claims the demo syllabus itself is unchanged: re-run the real
// audit live before recording.
import { createHash } from "node:crypto";
import type { PolicyProvenance, SchoolPolicy } from "../lib/policy/types";
import "../test-support/register-typescript.mjs";

// Native Node TS entry points — at runtime the resolve hook in test-support adds the .ts extension.
const { POLICY_TOPICS } = await import("../lib/policy/types");
const { corpusPolicies } = await import("../lib/policy/corpus");
const { isPublicHttp, pageText } = await import("../lib/sources");

/** Whitespace-collapse match, the same freedom verifyQuote allows for line wraps. */
function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function isReviewedOcr(policy: SchoolPolicy): policy is SchoolPolicy & { provenance: PolicyProvenance } {
  return policy.provenance?.method === "reviewed_ocr";
}

const policies = (await corpusPolicies(POLICY_TOPICS)) as SchoolPolicy[];

// Keep the packet's topic order so the output reads like the evidence packet.
const order = new Map(POLICY_TOPICS.map((topic: string, i: number) => [topic, i] as const));
policies.sort((a, b) => (order.get(a.topic) ?? 0) - (order.get(b.topic) ?? 0));

let failed = 0;
const lines: string[] = [];
for (const policy of policies) {
  const url = isPublicHttp(policy.url) ? policy.url : null;
  if (!url) {
    failed++;
    lines.push(`FAIL  ${policy.topic}: not a public https URL (${policy.url})`);
    continue;
  }
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) {
      failed++;
      lines.push(`FAIL  ${policy.topic}: HTTP ${res.status} at ${url}`);
      continue;
    }
    if (isReviewedOcr(policy)) {
      const body = Buffer.from(await res.arrayBuffer());
      if (sha256(body) === policy.provenance.sourcePdfSha256) {
        lines.push(`PASS  ${policy.topic}: source PDF unchanged (sha256 matches the admitted artifact) ${url}`);
      } else {
        failed++;
        lines.push(`CHANGED  ${policy.topic}: the PDF at ${url} differs from the admitted source (re-check the quote region by hand)`);
      }
      continue;
    }
    const html = await res.text();
    const found = normalize(pageText(html)).includes(normalize(policy.quote));
    if (found) {
      lines.push(`PASS  ${policy.topic}: quote still on the live page ${url}`);
    } else {
      failed++;
      lines.push(`CHANGED  ${policy.topic}: quote no longer on the live page ${url}`);
      lines.push(`        quote to look for: "${normalize(policy.quote).slice(0, 120)}..."`);
    }
  } catch (error) {
    failed++;
    lines.push(`FAIL  ${policy.topic}: ${error instanceof Error ? error.message : "fetch failed"} at ${url}`);
  }
}

console.log(lines.join("\n"));
console.log(`\n${policies.length} topics checked, ${policies.length - failed} pass, ${failed} need attention.`);
if (policies.length < POLICY_TOPICS.length) {
  console.error(`Only ${policies.length} of ${POLICY_TOPICS.length} topics produced a corpus quote — run the policy tests before recording.`);
  process.exitCode = 1;
}
if (failed) process.exitCode = 1;
