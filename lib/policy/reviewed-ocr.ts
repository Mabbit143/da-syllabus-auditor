import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { POLICY_TOPICS, type PolicyTopic, type SchoolPolicy, type PolicyProvenance } from "./types";

type ObjectValue = Record<string, unknown>;
const object = (value: unknown): value is ObjectValue => !!value && typeof value === "object" && !Array.isArray(value);
const hash = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const ROOT = path.join(process.cwd(), "data/uo-policies/reviewed-ocr");

function sourceUrl(value: unknown): URL | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && (!url.port || url.port === "443") && (url.hostname === "uoregon.edu" || url.hostname.endsWith(".uoregon.edu")) ? url : null;
  } catch { return null; }
}

/** Only the local owner-reviewed manifest authorizes OCR; client cache metadata never does. */
export async function loadReviewedPolicies(topics: readonly PolicyTopic[], root = ROOT): Promise<SchoolPolicy[]> {
  try {
    const file = await readFile(path.join(root, "index.json"));
    if (file.length > 2 * 1024 * 1024) throw new Error("Manifest too large");
    const index: unknown = JSON.parse(file.toString("utf8"));
    if (!object(index) || index.version !== 1 || !Array.isArray(index.records) || index.records.length > 1000) throw new Error("Invalid admission manifest");
    const records = index.records.filter(object);
    const out: SchoolPolicy[] = [];
    for (const topic of topics) {
      const selected = records.filter((r) => r.topic === topic && r.selected === true);
      if (selected.length !== 1 || !(POLICY_TOPICS as readonly string[]).includes(topic)) continue;
      const r = selected[0];
      try {
        const url = sourceUrl(r.sourceUrl);
        if (!url || r.version !== 1 || r.approved !== true || !hash(r.id) || !hash(r.artifactSha256) || !hash(r.imageSha256) || !hash(r.sourcePdfSha256) || !Number.isInteger(r.page) || Number(r.page) < 1 || typeof r.quote !== "string" || r.quote.length < 40 || r.quote.length > 700 || !["text", "ocr"].includes(String(r.extractionMethod)) || typeof r.reviewedAt !== "string" || !Number.isFinite(Date.parse(r.reviewedAt)) || !/(Z|[+-]\d\d:\d\d)$/.test(r.reviewedAt)) throw new Error("Invalid admission");
        const bytes = await readFile(path.join(root, "artifacts", `${r.artifactSha256}.json`));
        if (bytes.length > 16 * 1024 * 1024 || sha(bytes) !== r.artifactSha256) throw new Error("Artifact changed");
        const artifact: unknown = JSON.parse(bytes.toString("utf8"));
        if (!object(artifact) || artifact.version !== 1 || artifact.sourceUrl !== r.sourceUrl || artifact.sourcePdfSha256 !== r.sourcePdfSha256 || !Array.isArray(artifact.pages)) throw new Error("Source mismatch");
        const pages = artifact.pages.filter((p): p is ObjectValue => object(p) && p.page === r.page);
        if (pages.length !== 1) throw new Error("Ambiguous source page");
        const page = pages[0];
        if (page.method !== r.extractionMethod || page.imageSha256 !== r.imageSha256 || typeof page.text !== "string" || !page.text.includes(r.quote) || !Number.isInteger(page.width) || !Number.isInteger(page.height)) throw new Error("Quote or source mismatch");
        const image = await readFile(path.join(root, "artifacts", `${r.imageSha256}.png`));
        if (image.length < 24 || image.length > 2 * 1024 * 1024 || sha(image) !== r.imageSha256 || !image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) || image.readUInt32BE(16) !== page.width || image.readUInt32BE(20) !== page.height) throw new Error("Image changed");
        const region = r.region;
        if (!Array.isArray(region) || region.length !== 4 || !region.every((n) => Number.isInteger(n) && n >= 0) || region[2] < 1 || region[3] < 1 || region[0] + region[2] > Number(page.width) || region[1] + region[3] > Number(page.height)) throw new Error("Invalid source region");
        const provenance: PolicyProvenance = { method: "reviewed_ocr", page: Number(r.page), region: region as [number, number, number, number], sourcePdfSha256: r.sourcePdfSha256, artifactSha256: r.artifactSha256, imageSha256: r.imageSha256, reviewedAt: r.reviewedAt, extractionMethod: r.extractionMethod as "text" | "ocr" };
        url.hash = `page=${r.page}`;
        out.push({ topic, url: url.href, quote: r.quote, provenance });
      } catch { console.error(`[policy/ocr] ${topic} admission failed verification`); }
    }
    return out;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") console.error("[policy/ocr] admission manifest unavailable or invalid");
    return [];
  }
}
