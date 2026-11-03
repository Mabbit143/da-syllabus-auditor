import { expect, test, type Page } from "@playwright/test";

const user = { id: "11111111-1111-4111-8111-111111111111", aud: "authenticated", role: "authenticated", email: "owner@example.test", user_metadata: {}, app_metadata: {} };

async function account(page: Page) {
  await page.route("**/auth/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/token")) return route.fulfill({ json: { access_token: "owner-token", refresh_token: "test-refresh", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: "bearer", user } });
    if (path.endsWith("/user")) return route.fulfill({ json: user });
    if (path.endsWith("/logout")) return route.fulfill({ status: 204 });
    return route.abort();
  });
  await page.goto("/blindspot");
  await page.getByRole("button", { name: "Sign in to save" }).click();
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill("test-only-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

test("signed-out research never requests private data", async ({ page, request }) => {
  let calls = 0;
  await page.route("**/api/research**", (route) => { calls++; return route.abort(); });
  await page.goto("/blindspot");
  await expect(page.getByText("Sign in to view private research.", { exact: true })).toBeVisible();
  expect(calls).toBe(0);
  const response = await request.get("/api/research");
  expect(response.status()).toBe(401);
  expect(response.headers()["cache-control"]).toContain("no-store");
});

test("non-owner sees access refusal rather than research", async ({ page }) => {
  await page.route("**/api/research**", (route) => route.fulfill({ status: 403, json: { error: "This page is available only to the app owner." } }));
  await account(page);
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("This page is available only to the app owner.");
  await expect(page.getByRole("button", { name: "Sources", exact: true })).toHaveCount(0);
});

test("owner reads evidence, records review and clears data on sign-out", async ({ page }) => {
  const reviews: object[] = [];
  let scanApprovals = 0;
  const evidence = { version_id: 12, url: "https://policies.uoregon.edu/example", content_hash: "test-hash", quote: "Access is available to all applicants.", start: 0, end: 38, page: null, role: "policy" };
  const discovery = { registered_sources: 18, queries: [{ id: 1, day: "2026-11-03", query: "University of Oregon administration interviews", state: "completed", error: null, result_count: 19, result_urls: ["https://news.example/report"] }] };
  await page.route("**/api/**", (route) => route.abort());
  await page.route("**/api/research**", async (route) => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      expect(body.actor).toBeUndefined();
      if (body.action === "scan_passage") {
        expect(body.confirmed).toBe(true);
        expect(body.pdf_sha256).toBe("a".repeat(64));
        expect(body.quote).toBe("Applicants may request a fee waiver before submitting the application.");
        scanApprovals++;
        return route.fulfill({ json: { saved: true, receipt_id: "receipt-test", version_id: 20 } });
      }
      reviews.push({ ...body, id: reviews.length + 1, actor: user.id, created_at: 20 });
      return route.fulfill({ json: { saved: true } });
    }
    if (new URL(route.request().url()).searchParams.get("version") === "13") return route.fulfill({ json: { id: 13, url: "https://news.uoregon.edu/heading", content_hash: "heading-hash", metadata: { title: "Headline without body", coverage: "Headline only." }, quality: { state: "headline_only", analysis_ready: false, note: "Only heading text was extracted; article/body content is unavailable in this snapshot. Analysis is deferred." }, text: "Headline without body", start: 0, total_characters: 21, physical_pages: [], history: [{ id: 13, first_seen: 10, last_seen: 10, content_hash: "heading-hash" }] } });
    if (new URL(route.request().url()).searchParams.has("scan")) return route.fulfill({ json: { scan_id: 1, url: "https://uoregon.edu/scan.pdf", pdf_sha256: "a".repeat(64), page: 1, page_count: 1, image_sha256: "b".repeat(64), width: 100, height: 100, image_data_url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aV1UAAAAASUVORK5CYII=", receipts: [], method: "owner-reviewed transcription; no automatic OCR approval" } });
    if (new URL(route.request().url()).searchParams.has("version")) return route.fulfill({ json: { id: 12, url: evidence.url, content_hash: "test-hash", metadata: { title: "Example source", coverage: "Stored workbook values; formulas not recalculated." }, text: evidence.quote, start: 0, total_characters: 38, physical_pages: [], source_locations: { items: [{ label: "Sheet Allocation, row 1", start: 0, end: 38, cells: [{ cell: "A1", cached: false, formula: null }, { cell: "B1", cached: true, formula: "SUM(C1:D1)" }] }], omitted_locations: 0, note: "Locations intersect supplied text only." }, history: [{ id: 12, first_seen: 10, last_seen: 10, content_hash: "test-hash" }] } });
    return route.fulfill({ json: {
      status: { discovery, documents: 415, versions: 415, analysis_reports: 1, latest_analysis_at: 10, jobs: [{ kind: "analyze", state: "pending", count: 414 }, { kind: "synthesize", state: "pending", count: 1 }, { kind: "synthesize", state: "superseded", count: 7 }], failures: [], monitor: { schedule: { runner: "verification", interval: 10, next_due: 30, lease_until: null }, runs: [{ id: 2, runner: "verification", state: "completed", started_at: 10, finished_at: 20, error: null, collection: { collected: 1 }, analysis: { completed: 1, daily_limit: 4 } }], model_usage: [{ day: "2026-11-03", calls: 3 }] } },
      documents: [{ id: 12, title: "Example source", url: evidence.url, category: "policy", method: "html", archived_snapshot: true, original_fetched_date: "2026-10-27", first_seen: 10, last_seen: 10 }],
      page: 1, total_documents: 1, reviews, storage: "local-worker", history_limits: { reports: 100, reviews: 500 },
      coverage: { total_documents: 415, archived_snapshots: 398, headline_only: 1, categories: { policy: { documents: 414, analysis_ready: 414, headline_only: 0, archived: 398 }, press_release: { documents: 1, analysis_ready: 0, headline_only: 1, archived: 0 } }, headline_examples: [{ version_id: 13, url: "https://news.uoregon.edu/heading", title: "Headline without body" }], note: "Categories are intake labels; text availability does not establish full coverage." },
      scans: { total_sources: 1, limit: 20, sources: [{ id: 1, url: "https://uoregon.edu/scan.pdf", pdf_sha256: "a".repeat(64), page_count: 1, needs_review_pages: [1], approved_passages: scanApprovals }] },
      synthesis: { id: 1, completed_at: 20, input_current: false, report: {
        incidents: [{ id: "i1", summary: "A reported access restriction needs investigation.", basis: "allegation", status: "unresolved", mechanism_code: "eligibility_barrier", lead_ids: ["r2:f2"], evidence_ids: ["e1"], temporal_scope: "Historical source; current applicability unknown.", distinctness: "Underlying event identity remains uncertain.", skeptic: { decision: "unresolved", reason: "An allegation does not establish an outcome.", distinctness: "Cannot establish distinct events from this source alone.", temporal_scope: "Historical only", alternative_explanations: ["Repeated coverage could describe one event."], counterevidence_ids: [] } }],
        patterns: [], evidence: [{ ...evidence, id: "e1", role: "action" }], leads: [{ id: "r2:f2", report_id: 2, finding_id: "f2", claim: "A reported restriction" }], coverage: { recent_reports: 2, omitted_leads: 0, invalid_evidence_leads: 0, note: "Supplied passages only." }, rejected_count: 1, limitations: "Private review leads; originating lineages remain unverified."
      } },
      patterns: { evidence_groups: [{ id: "group1", status: "incident_identity_unverified", members: [{ report_id: 2, finding_id: "f2", claim: "An attributed allegation requiring review.", topic: "Access", mechanism: "Restrictive eligibility", status: "unresolved", owner_status: null, actions: [{ ...evidence, role: "action" }] }] }], mechanism_candidates: [], limitations: "Different passages may describe the same incident." },
      reports: [{ id: 1, completed_at: 10, report: { findings: [], observations: [{ id: "f1", claim: "A policy commitment to equal access.", topic: "Access", mechanism: "Stated commitment", evidence: [evidence], questions: ["What happens in practice?"], temporal_scope: "Applicability date unknown", temporal_status: "historical_or_undated", status: "source_observation", publisher_groups: 1, distinct_documents: 1, skeptic: { decision: "retain", reason: "The passage supports the observation.", counterevidence_search: "Checked supplied portions only.", alternative_explanations: [], temporal_scope: "Unknown", counterevidence: [] } }], rejected_count: 2, retrieval: { method: "bm25_documents_v1", candidate_documents: 30, matching_related_documents: 9, omitted_related_documents: 4, identical_content_collapsed: 3, limits: "Policy applicability requires evidence review." }, coverage: [{ version_id: 12, reviewed_characters: 38, total_characters: 200 }] } }],
    } });
  });
  await account(page);
  await expect(page.getByText("415 documents", { exact: true })).toBeVisible();
  await expect(page.getByText("Collection queue: 0 · Analysis queue: 414 · Pattern queue: 1", { exact: true })).toBeVisible();
  await page.getByText("Saved source coverage", { exact: true }).click();
  await expect(page.getByText(/1 headline-only record\(s\) excluded from analysis/)).toBeVisible();
  await page.getByRole("button", { name: "Inspect saved headline", exact: true }).click();
  await expect(page.getByRole("region", { name: "Saved document" })).toContainText("Only heading text was extracted");
  await page.getByText("Scanned and sparse-text PDFs (1)", { exact: true }).click();
  await page.getByRole("button", { name: "Load source page", exact: true }).click();
  await expect(page.getByRole("img", { name: "Saved source PDF page 1" })).toBeVisible();
  await page.getByLabel("Exact passage checked against the image").fill("Applicants may request a fee waiver before submitting the application.");
  await expect(page.getByRole("button", { name: "Save reviewed passage", exact: true })).toBeDisabled();
  await page.getByLabel("I compared this exact passage against the source image, including qualifications and exceptions.").check();
  await page.getByLabel("Review region Width", { exact: true }).fill("150");
  await page.getByLabel("I compared this exact passage against the source image, including qualifications and exceptions.").check();
  await expect(page.getByRole("button", { name: "Save reviewed passage", exact: true })).toBeDisabled();
  await page.getByLabel("Review region Width", { exact: true }).fill("100");
  await page.getByLabel("I compared this exact passage against the source image, including qualifications and exceptions.").check();
  await page.getByRole("button", { name: "Save reviewed passage", exact: true }).click();
  await expect(page.getByText("Reviewed passage saved and queued for analysis. Only this passage was admitted.", { exact: true })).toBeVisible();
  expect(scanApprovals).toBe(1);
  await expect(page.getByRole("region", { name: "Cross-report investigation" })).toContainText("Historical snapshot");
  await page.getByText("Underlying incident proposals (1)", { exact: true }).click();
  await expect(page.getByText(/Attributed allegation; no outcome established/)).toBeVisible();
  await page.getByRole("button", { name: "Inspect synthesis citation", exact: true }).click();
  await expect(page.getByRole("region", { name: "Saved document" })).toContainText(evidence.quote);
  await page.getByText("Word and spreadsheet source locations", { exact: true }).click();
  await expect(page.getByText(/B1 \(cached formula result; not recalculated\)/)).toBeVisible();
  await page.getByText("Underlying incident proposals (1)", { exact: true }).click();
  await page.getByText("Evidence groups and possible recurring mechanisms", { exact: true }).click();
  await expect(page.getByText("Different passages may describe the same incident.", { exact: true })).toBeVisible();
  await page.getByText("Evidence group 1: 1 related lead(s)", { exact: true }).click();
  await page.getByRole("button", { name: "Read saved context", exact: true }).click();
  await expect(page.getByRole("region", { name: "Saved document" })).toContainText(evidence.quote);
  await page.getByText("Evidence groups and possible recurring mechanisms", { exact: true }).click();
  await expect(page.getByText(/Timed worker verification recorded/)).toBeVisible();
  await page.getByText("Worker run history and model usage", { exact: true }).click();
  await expect(page.getByText(/Run 2: completed/)).toBeVisible();
  await page.getByText("Internet discovery (18 candidate URLs)", { exact: true }).click();
  await expect(page.getByText(/University of Oregon administration interviews/)).toBeVisible();
  await page.getByRole("button", { name: "Source observations (1)" }).click();
  await page.getByText("Analysis coverage and rejected proposals", { exact: true }).click();
  await expect(page.getByText(/9 matched, 4 omitted by the five-document limit/)).toBeVisible();
  await expect(page.getByText(/Policy applicability requires evidence review/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "A policy commitment to equal access." })).toBeVisible();
  await page.getByRole("button", { name: "Read saved passage" }).click();
  await expect(page.getByRole("region", { name: "Saved document" })).toContainText(evidence.quote);
  await page.getByLabel("Review note").fill("Check the effective date against the original.");
  await page.getByRole("button", { name: "Save review", exact: true }).click();
  await expect(page.getByText("Check the effective date against the original.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sources", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Example source", level: 3 })).toBeVisible();
  await page.getByRole("button", { name: "Read saved document" }).click();
  await expect(page.getByRole("region", { name: "Saved document" })).toContainText(evidence.quote);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("img", { name: "Saved source PDF page 1" })).toHaveCount(0);
  await expect(page.getByText(evidence.quote, { exact: true })).toHaveCount(0);
  await page.goto("/blindspot");
  await expect(page.getByText("Sign in to view private research.", { exact: true })).toBeVisible();
  await expect(page.getByText(evidence.quote, { exact: true })).toHaveCount(0);
});
