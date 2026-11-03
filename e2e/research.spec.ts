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
  const evidence = { version_id: 12, url: "https://policies.uoregon.edu/example", content_hash: "test-hash", quote: "Access is available to all applicants.", start: 0, end: 38, page: null, role: "policy" };
  await page.route("**/api/**", (route) => route.abort());
  await page.route("**/api/research**", async (route) => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      expect(body.actor).toBeUndefined();
      reviews.push({ ...body, id: reviews.length + 1, actor: user.id, created_at: 20 });
      return route.fulfill({ json: { saved: true } });
    }
    if (new URL(route.request().url()).searchParams.has("version")) return route.fulfill({ json: { id: 12, url: evidence.url, content_hash: "test-hash", metadata: { title: "Example source" }, text: evidence.quote, start: 0, total_characters: 38, physical_pages: [], history: [{ id: 12, first_seen: 10, last_seen: 10, content_hash: "test-hash" }] } });
    return route.fulfill({ json: {
      status: { documents: 415, versions: 415, analysis_reports: 1, latest_analysis_at: 10, jobs: [{ kind: "analyze", state: "pending", count: 414 }], failures: [], monitor: { schedule: { runner: "verification", interval: 10, next_due: 30, lease_until: null }, runs: [{ id: 2, runner: "verification", state: "completed", started_at: 10, finished_at: 20, error: null, collection: { collected: 1 }, analysis: { completed: 1, daily_limit: 4 } }], model_usage: [{ day: "2026-11-03", calls: 3 }] } },
      documents: [{ id: 12, title: "Example source", url: evidence.url, category: "policy", method: "html", archived_snapshot: true, original_fetched_date: "2026-10-27", first_seen: 10, last_seen: 10 }],
      page: 1, total_documents: 1, reviews, storage: "local-worker", history_limits: { reports: 100, reviews: 500 },
      reports: [{ id: 1, completed_at: 10, report: { findings: [], observations: [{ id: "f1", claim: "A policy commitment to equal access.", topic: "Access", mechanism: "Stated commitment", evidence: [evidence], questions: ["What happens in practice?"], temporal_scope: "Applicability date unknown", temporal_status: "historical_or_undated", status: "source_observation", publisher_groups: 1, distinct_documents: 1, skeptic: { decision: "retain", reason: "The passage supports the observation.", counterevidence_search: "Checked supplied portions only.", alternative_explanations: [], temporal_scope: "Unknown", counterevidence: [] } }], rejected_count: 2, coverage: [{ version_id: 12, reviewed_characters: 38, total_characters: 200 }] } }],
    } });
  });
  await account(page);
  await expect(page.getByText("415 documents", { exact: true })).toBeVisible();
  await expect(page.getByText(/Timed worker verification recorded/)).toBeVisible();
  await page.getByText("Worker run history and model usage", { exact: true }).click();
  await expect(page.getByText(/Run 2: completed/)).toBeVisible();
  await page.getByRole("button", { name: "Source observations (1)" }).click();
  await expect(page.getByRole("heading", { name: "A policy commitment to equal access." })).toBeVisible();
  await page.getByRole("button", { name: "Read saved passage" }).click();
  await expect(page.getByRole("region", { name: "Saved document" })).toContainText(evidence.quote);
  await page.getByLabel("Review note").fill("Check the effective date against the original.");
  await page.getByRole("button", { name: "Save review" }).click();
  await expect(page.getByText("Check the effective date against the original.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sources", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Example source", level: 3 })).toBeVisible();
  await page.getByRole("button", { name: "Read saved document" }).click();
  await expect(page.getByRole("region", { name: "Saved document" })).toContainText(evidence.quote);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByText(evidence.quote, { exact: true })).toHaveCount(0);
  await page.goto("/blindspot");
  await expect(page.getByText("Sign in to view private research.", { exact: true })).toBeVisible();
  await expect(page.getByText(evidence.quote, { exact: true })).toHaveCount(0);
});
