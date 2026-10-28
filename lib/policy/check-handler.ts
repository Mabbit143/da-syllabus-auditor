import type { Coverage, Page } from "../types";
import { parseCourseContext } from "./contents";
import type { CourseContext, RequiredContents } from "./contents-types";
import { usesUoCorpus } from "./corpus";
import { POLICY_TOPICS, type PolicyComparison, type PolicyTopic, type SchoolPolicy } from "./types";

interface Services {
  local: (topics: readonly PolicyTopic[]) => Promise<SchoolPolicy[]>;
  recheck: (school: string, saved: SchoolPolicy[]) => Promise<SchoolPolicy[]>;
  lookup: (school: string, topics: readonly PolicyTopic[]) => Promise<SchoolPolicy[]>;
  compare: (pages: Page[], policies: SchoolPolicy[]) => Promise<PolicyComparison[]>;
  contents: (pages: Page[], coverage: Coverage, context: CourseContext, deadline: number) => Promise<RequiredContents>;
}
const fail = (status: number, code: string, message: string) => Response.json({ error: { code, message } }, { status });

/** Dependencies are external boundaries; request validation stays real in tests. */
export function createPolicyCheckHandler(services: Services) {
  return async function POST(request: Request): Promise<Response> {
    const deadline = Date.now() + 240_000;
    try {
      let body: Record<string, unknown>;
      try {
        const parsed: unknown = await request.json();
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return fail(400, "invalid_request", "A request object is required.");
        body = parsed as Record<string, unknown>;
      } catch { return fail(400, "bad_json", "Request was not valid JSON."); }
      const school = typeof body.school === "string" ? body.school.trim().slice(0, 100) : "";
      if (school.length < 3) return fail(400, "invalid_request", "A school name is required.");
      const pages = body.pages;
      if (!Array.isArray(pages) || !pages.length || pages.length > 80 || !pages.every((p) => p && Number.isInteger(p.pageNumber) && p.pageNumber > 0 && typeof p.text === "string" && p.text.length <= 20_000) || new Set(pages.map((p) => p.pageNumber)).size !== pages.length) return fail(400, "invalid_request", "Unique numbered pages with readable text are required.");
      const context = body.requiredContentsContext === undefined ? undefined : parseCourseContext(body.requiredContentsContext);
      if (context === null) return fail(400, "invalid_context", "Please choose a valid course term, year, level and Core Education setting.");
      if (context && !usesUoCorpus(school)) return fail(400, "unsupported_school", "Required syllabus contents are available for University of Oregon courses.");
      if (body.contentsOnly !== undefined && typeof body.contentsOnly !== "boolean") return fail(400, "invalid_request", "contentsOnly must be a boolean.");
      if (body.contentsOnly && !context) return fail(400, "invalid_context", "Course context is required for this check.");
      const suppliedCoverage = body.coverage as Partial<Coverage> | undefined;
      if (context && suppliedCoverage !== undefined && (!suppliedCoverage || !["full", "partial"].includes(String(suppliedCoverage.status)) || !Array.isArray(suppliedCoverage.skipped) || !suppliedCoverage.skipped.every((s) => typeof s === "string"))) return fail(400, "invalid_coverage", "The document coverage is invalid. Please select the syllabus again.");
      const complete = Number.isInteger(body.pageCount) && body.pageCount === pages.length && pages.every((p, i) => p.pageNumber === i + 1);
      const unreadable = pages.filter((p) => !p.text.trim());
      const coverage: Coverage = {
        status: suppliedCoverage?.status === "full" && complete && unreadable.length === 0 && suppliedCoverage.skipped?.length === 0 ? "full" : "partial",
        skipped: Array.isArray(suppliedCoverage?.skipped) ? suppliedCoverage.skipped.slice(0, 80).map((s) => s.slice(0, 200)) : [],
      };
      if (!complete) coverage.skipped.push("Complete page coverage could not be confirmed.");
      for (const page of unreadable) coverage.skipped.push(`Page ${page.pageNumber} has no readable text and was not assessed.`);
      const saved = (Array.isArray(body.saved) ? body.saved : []).filter((p): p is SchoolPolicy => !!p && typeof p.url === "string" && typeof p.quote === "string" && (POLICY_TOPICS as readonly string[]).includes(p.topic)).slice(0, POLICY_TOPICS.length);
      let policies: SchoolPolicy[] = [], looked: SchoolPolicy[] = [], items: PolicyComparison[] = [];
      if (!body.contentsOnly) {
        const local = usesUoCorpus(school) ? await services.local(POLICY_TOPICS) : [];
        const cached = await services.recheck(school, saved.filter((p) => !local.some((l) => l.topic === p.topic)));
        policies = [...local, ...cached];
        looked = await services.lookup(school, POLICY_TOPICS.filter((t) => !policies.some((p) => p.topic === t)));
        policies.push(...looked);
        items = await services.compare(pages, policies);
      }
      let requiredContents: RequiredContents | undefined;
      if (context) {
        try { requiredContents = await services.contents(pages, coverage, context, deadline); }
        catch {
          console.error("[api/policy-check] required contents unavailable; existing comparison retained");
          requiredContents = { context, snapshotDate: "2026-10-27", groups: [], coverage: { status: "partial", skipped: ["Required contents could not be checked."] }, error: "Required contents could not be checked. Please try again." };
        }
      }
      return Response.json({ policies, items, newPolicies: !body.contentsOnly && (looked.length > 0 || policies.length !== saved.length), ...(requiredContents ? { requiredContents } : {}) });
    } catch {
      console.error("[api/policy-check] request failed; no report returned");
      return fail(500, "policy_check_failed", "The policy check could not be completed. Please try again.");
    }
  };
}
