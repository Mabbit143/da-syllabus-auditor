import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import topicRegistry from "../../data/evidence-topics.json" with { type: "json" };

type ObjectValue = Record<string, unknown>;
const object = (value: unknown): value is ObjectValue => !!value && typeof value === "object" && !Array.isArray(value);
const hash = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const ROOT = path.join(process.cwd(), "data/uo-policies/reviewed-ocr");

export interface TopicInfo {
  id: string;
  label: string;
  description: string;
  syllabusComparable: boolean;
}

const KNOWN_TOPICS: Record<string, TopicInfo> = Object.fromEntries(
  (topicRegistry.topics as TopicInfo[]).map((t) => [t.id, t]),
);

/** Falls back to the raw id so a topic admitted before its label is registered still renders. */
export function topicInfo(id: string): TopicInfo {
  return KNOWN_TOPICS[id] ?? { id, label: id, description: "", syllabusComparable: false };
}

export interface EvidenceRecord {
  topic: TopicInfo;
  quote: string;
  sourceUrl: string;
  page: number;
  reviewedAt: string;
  extractionMethod: "text" | "ocr";
}

function sourceUrl(value: unknown): URL | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && (!url.port || url.port === "443") && (url.hostname === "uoregon.edu" || url.hostname.endsWith(".uoregon.edu")) ? url : null;
  } catch { return null; }
}

/**
 * Every admitted, selected record from the reviewed-ocr corpus, regardless of topic —
 * the open Blindspot Engine evidence record. Unlike loadReviewedPolicies (lib/policy/reviewed-ocr.ts),
 * this is NOT filtered to PolicyTopic / POLICY_TOPICS; it is the superset used by the public evidence page.
 */
export async function loadAllEvidence(root = ROOT): Promise<EvidenceRecord[]> {
  try {
    const file = await readFile(path.join(root, "index.json"));
    if (file.length > 2 * 1024 * 1024) throw new Error("Manifest too large");
    const index: unknown = JSON.parse(file.toString("utf8"));
    if (!object(index) || index.version !== 1 || !Array.isArray(index.records) || index.records.length > 1000) throw new Error("Invalid admission manifest");
    const out: EvidenceRecord[] = [];
    // "selected" only means "the active source for live syllabus comparison" (lib/policy/corpus.ts);
    // the evidence page shows every approved admission, selected or not.
    for (const r of index.records.filter(object)) {
      if (r.approved !== true) continue;
      try {
        const url = sourceUrl(r.sourceUrl);
        if (!url || r.version !== 1 || r.approved !== true || !hash(r.id) || !hash(r.artifactSha256) || !hash(r.imageSha256) || !hash(r.sourcePdfSha256) || !Number.isInteger(r.page) || Number(r.page) < 1 || typeof r.quote !== "string" || r.quote.length < 40 || r.quote.length > 700 || !["text", "ocr"].includes(String(r.extractionMethod)) || typeof r.topic !== "string" || typeof r.reviewedAt !== "string" || !Number.isFinite(Date.parse(r.reviewedAt))) throw new Error("Invalid admission");
        const bytes = await readFile(path.join(root, "artifacts", `${r.artifactSha256}.json`));
        if (bytes.length > 16 * 1024 * 1024 || sha(bytes) !== r.artifactSha256) throw new Error("Artifact changed");
        const artifact: unknown = JSON.parse(bytes.toString("utf8"));
        if (!object(artifact) || artifact.version !== 1 || artifact.sourceUrl !== r.sourceUrl || artifact.sourcePdfSha256 !== r.sourcePdfSha256 || !Array.isArray(artifact.pages)) throw new Error("Source mismatch");
        const pages = artifact.pages.filter((p): p is ObjectValue => object(p) && p.page === r.page);
        if (pages.length !== 1) throw new Error("Ambiguous source page");
        const page = pages[0];
        if (page.method !== r.extractionMethod || page.imageSha256 !== r.imageSha256 || typeof page.text !== "string" || !page.text.includes(r.quote)) throw new Error("Quote or source mismatch");
        url.hash = `page=${r.page}`;
        out.push({ topic: topicInfo(r.topic as string), quote: r.quote, sourceUrl: url.href, page: Number(r.page), reviewedAt: r.reviewedAt, extractionMethod: r.extractionMethod as "text" | "ocr" });
      } catch { console.error(`[evidence] admission for topic "${String(r.topic)}" failed verification`); }
    }
    return out;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") console.error("[evidence] admission manifest unavailable or invalid");
    return [];
  }
}
