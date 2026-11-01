import { createHash } from "node:crypto";
import { squash } from "../sources";
import type { Page } from "../types";
import { verifyQuote } from "../verify";
import { POLICY_TOPICS, TOPIC_WORDS, type PolicyComparison, type PolicyTopic } from "./types";

export interface GapRow {
  school: string;
  topic: string;
  kind: "conflicts" | "adds_requirement" | "silent";
  instructor: string | null;
  syllabus_quote: string | null;
  syllabus_page: number | null;
  school_quote: string;
  school_url: string;
  syllabus_hash: string;
}

interface Services {
  /** Verifies the bearer token belongs to a real signed-in user; returns their id, or null if not. */
  authenticate: (token: string | null) => Promise<string | null>;
  /** Re-fetches the school's own page and confirms the quote is still on it. Never trusts the browser's word alone. */
  verifySchoolQuote: (url: string, quote: string) => Promise<boolean>;
  /** Inserts with a service-role key, bypassing RLS; the open client-insert policy is dropped (db/003). */
  insert: (rows: GapRow[]) => Promise<void>;
}

const fail = (status: number, code: string, message: string) => Response.json({ error: { code, message } }, { status });
const MAX_ITEMS = 20; // a syllabus audit covers at most 11 policy topics
const RECORDED_RELATIONS = new Set(["conflicts", "adds_requirement", "silent"]);

function fingerprint(pages: Page[]): string {
  const text = pages.map((p) => p.text).join("\n").replace(/\s+/g, " ").trim().toLowerCase();
  return createHash("sha256").update(text).digest("hex");
}

/**
 * The browser sends only a name, not the quote compare.ts verified it in, so the server checks the
 * name itself sits in the submitted pages (case and line-wrap whitespace ignored). A name that is
 * not there is stored as null and the finding is kept: the finding is verified on its own quotes,
 * and an unsupported name must never be attached to it.
 */
function verifiedInstructor(name: unknown, allText: string): string | null {
  if (typeof name !== "string") return null;
  const clean = squash(name).slice(0, 200);
  if (!clean) return null;
  return squash(allText).toLowerCase().includes(clean.toLowerCase()) ? clean : null;
}

function isPage(p: unknown): p is Page {
  return !!p && typeof p === "object" && Number.isInteger((p as Page).pageNumber) && (p as Page).pageNumber > 0 && typeof (p as Page).text === "string" && (p as Page).text.length <= 20_000;
}

/**
 * Re-verifies every finding before it reaches the shared master list. The client that calls this
 * route already ran a real policy check, but it is still an untrusted browser: a signed-in user
 * could otherwise post any row they like with the anon key (see db/002-policy-gaps.sql's "Known
 * weakness" note). Nothing here trusts the request's syllabus or school quotes without re-checking
 * them the same way the rest of the app does — code decides, not the caller.
 */
export function createRecordGapsHandler(services: Services) {
  return async function POST(request: Request): Promise<Response> {
    try {
      const authHeader = request.headers.get("authorization") ?? "";
      const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
      const userId = await services.authenticate(token);
      if (!userId) return fail(401, "not_signed_in", "Sign in to continue.");

      let body: Record<string, unknown>;
      try {
        const parsed: unknown = await request.json();
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return fail(400, "invalid_request", "A request object is required.");
        body = parsed as Record<string, unknown>;
      } catch { return fail(400, "bad_json", "Request was not valid JSON."); }

      const school = typeof body.school === "string" ? body.school.trim().slice(0, 100) : "";
      if (school.length < 3) return fail(400, "invalid_request", "A school name is required.");

      const pagesInput = body.pages;
      if (!Array.isArray(pagesInput) || !pagesInput.length || pagesInput.length > 80 || !pagesInput.every(isPage)) {
        return fail(400, "invalid_request", "Unique numbered pages with readable text are required.");
      }
      const pages = pagesInput as Page[];

      const itemsInput = body.items;
      if (!Array.isArray(itemsInput) || itemsInput.length > MAX_ITEMS) return fail(400, "invalid_request", "A reasonable list of findings is required.");

      const hash = fingerprint(pages);
      const allText = pages.map((p) => p.text).join("\n");
      const rows: GapRow[] = [];
      for (const raw of itemsInput as Partial<PolicyComparison>[]) {
        if (!raw || typeof raw !== "object") continue;
        if (!raw.relation || !RECORDED_RELATIONS.has(raw.relation)) continue; // only agreed differences are recorded, never "matches" or "disputed"
        if (typeof raw.topic !== "string" || !(POLICY_TOPICS as readonly string[]).includes(raw.topic)) continue;
        // Same rule as compare.ts: silence is decided by code, never claimed when the pages mention the topic.
        if (raw.relation === "silent" && TOPIC_WORDS[raw.topic as PolicyTopic].test(allText)) continue;
        if (typeof raw.schoolQuote !== "string" || typeof raw.schoolUrl !== "string" || !raw.schoolQuote || !raw.schoolUrl) continue;

        // Same rules as compare.ts: a non-silent finding needs a syllabus quote that is really on the
        // claimed page and is about this topic. Anything else is dropped (not turned into silence:
        // the client already chose the relation). Silent findings carry no syllabus quote.
        let verified: ReturnType<typeof verifyQuote> = null;
        if (raw.relation !== "silent") {
          if (typeof raw.syllabusQuote !== "string" || !Number.isInteger(raw.syllabusPage)) continue;
          verified = verifyQuote(pages, raw.syllabusPage!, raw.syllabusQuote);
          if (!verified) continue; // the claimed syllabus quote is not actually an exact substring of that page — drop it, do not insert
          if (!TOPIC_WORDS[raw.topic as PolicyTopic].test(verified.text)) continue; // a real passage, but about something else
        }

        const schoolQuoteStillLive = await services.verifySchoolQuote(raw.schoolUrl, raw.schoolQuote);
        if (!schoolQuoteStillLive) continue; // the school's own page no longer contains this quote — drop it rather than record a stale claim

        rows.push({
          school, topic: raw.topic, kind: raw.relation as GapRow["kind"],
          instructor: verifiedInstructor(raw.instructor, allText),
          syllabus_quote: verified ? verified.text : null, // the page's own text, never the client's copy
          syllabus_page: verified ? verified.page : null,
          school_quote: raw.schoolQuote, school_url: raw.schoolUrl, syllabus_hash: hash,
        });
      }

      if (rows.length) await services.insert(rows);
      return Response.json({ recorded: rows.length });
    } catch {
      console.error("[api/record-gaps] request failed; nothing recorded");
      return fail(500, "record_gaps_failed", "Could not record this result.");
    }
  };
}
