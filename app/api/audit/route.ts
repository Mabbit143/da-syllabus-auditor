import { NextResponse } from "next/server";
import { runAudit } from "@/lib/audit";
import { callMeta, callMetaSearch } from "@/lib/meta";
import type { AuditRequest } from "@/lib/types";

export const maxDuration = 120;

const MAX_PAGES = 80;
const MAX_PAGE_CHARS = 20_000;
const MAX_TOTAL_CHARS = 300_000;

function fail(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function validate(body: unknown): AuditRequest | string {
  const b = body as Partial<AuditRequest> | null;
  if (!b || typeof b !== "object") return "Request body must be a JSON object.";
  if (typeof b.requestId !== "string" || typeof b.fileName !== "string") return "requestId and fileName are required.";
  if (!Number.isInteger(b.pageCount) || (b.pageCount as number) < 1) return "pageCount must be a positive integer.";
  if (!Array.isArray(b.pages) || b.pages.length !== b.pageCount) return "pages must match pageCount.";
  if (b.pages.length > MAX_PAGES) return `Syllabus is longer than ${MAX_PAGES} pages.`;
  let total = 0;
  for (let i = 0; i < b.pages.length; i++) {
    const p = b.pages[i];
    if (!p || p.pageNumber !== i + 1 || typeof p.text !== "string") return "Pages must be ordered and numbered from 1.";
    if (p.text.length > MAX_PAGE_CHARS) return `Page ${p.pageNumber} has too much text.`;
    total += p.text.length;
  }
  if (total < 200) return "No readable text.";
  if (total > MAX_TOTAL_CHARS) return "Syllabus text is too long.";
  return b as AuditRequest;
}

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return fail(400, "bad_json", "Request was not valid JSON.");
    }
    const req = validate(body);
    if (typeof req === "string") return fail(400, "invalid_request", req);

    const report = await runAudit(req, callMeta, callMetaSearch);
    return NextResponse.json({ requestId: req.requestId, report });
  } catch (err) {
    console.error("[api/audit] failed:", err instanceof Error ? err.message : err);
    return fail(500, "audit_failed", "The audit could not be completed. Please try again.");
  }
}
