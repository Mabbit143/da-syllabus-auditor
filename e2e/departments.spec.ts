import { expect, test, type Page } from "@playwright/test";
import type { AuditReport } from "../lib/types";

const STORE = "da-syllabus-auditor.courses.v1";
test.beforeEach(async ({ page }) => {
  // Block every unmocked analysis/account endpoint; these tests spend no credits.
  await page.route("**/api/**", (route) => route.fulfill({ status: 503, json: { error: { message: "Unexpected analysis request blocked by department regression." } } }));
  await page.route("**/rest/v1/**", (route) => route.abort());
  await page.route("**/auth/v1/**", (route) => route.abort());
});
function report(fileName: string, school?: string): AuditReport {
  return {
    fileName, pageCount: 1, coverage: { status: "full", skipped: [] }, dimensions: [],
    flags: [{ kind: "late", severity: "high", explanation: "Late work is not accepted.", passageId: "p1" }],
    assessments: [], passages: [{ id: "p1", page: 1, start: 0, end: 26, text: "Late work is not accepted." }],
    biggestRiskIndex: 0, overall: { label: null, reason: "No dimensions", included: 0, score: 0 },
    ...(school ? { policyCheck: { school, checkedAt: "2026-10-31T00:00:00Z", items: [] } } : {}),
  };
}
async function seed(page: Page, reports: AuditReport[]) {
  await page.addInitScript(({ key, reports }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(reports.map((report, i) => ({ id: `course-${i}`, report, pages: [{ pageNumber: 1, text: "Late work is not accepted." }] }))));
  }, { key: STORE, reports });
}
const card = (page: Page, code: string) => page.locator(".card").filter({ has: page.getByRole("heading", { name: new RegExp(`^${code} \\(`) }) });

test("combined inputs keep a course identifier across term view, reload and reopening", async ({ page }) => {
  await seed(page, [report("ANTH145-Syllabus.pdf")]);
  let sent: { fileName: string } | undefined;
  await page.route("**/api/audit", async (route) => {
    sent = route.request().postDataJSON();
    await route.fulfill({ json: { report: report(sent!.fileName) } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: /Combine pieces instead/ }).click();
  await page.getByLabel("Course code (optional)").fill("anth341");
  await page.getByLabel(/Label \(e.g./).fill("Course overview");
  await page.getByLabel("Text for piece 1").fill("Late work is not accepted. ".repeat(12));
  await page.getByRole("button", { name: "Audit combined syllabus", exact: true }).click();
  await expect(page.getByRole("button", { name: "Back to term view" })).toBeVisible();
  expect(sent?.fileName).toContain("ANTH 341");
  await page.getByRole("button", { name: "Back to term view" }).click();
  await expect(card(page, "ANTH")).toContainText("2 syllabi so far");
  await page.reload();
  await expect(card(page, "ANTH")).toContainText("2 syllabi so far");
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), STORE);
  expect(saved[1].report.courseCode).toBe("ANTH 341");
  await page.getByRole("button", { name: /ANTH 341.*Combined syllabus/ }).click();
  await expect(page.getByRole("heading", { name: "Overall read" })).toBeVisible();
});

test("unrelated departments never display or submit Anthropology evidence", async ({ page }) => {
  await seed(page, [report("ANTH145.pdf", "University of Oregon"), report("CS101.pdf", "University of Oregon")]);
  const payloads: { evidence: unknown }[] = [];
  await page.route("**/api/departments/packet", async (route) => {
    payloads.push(route.request().postDataJSON());
    await route.fulfill({ json: { packet: { letter: "Test draft", citedQuotes: [], evidenceQuote: null } } });
  });
  await page.goto("/");
  await expect(card(page, "ANTH").getByRole("heading", { name: "What ANTH itself publishes" })).toBeVisible();
  await expect(card(page, "CS").locator("blockquote")).toHaveCount(0);
  await expect(card(page, "CS")).not.toContainText("itself publishes");
  await card(page, "CS").getByRole("button", { name: "Generate accountability packet" }).click();
  await expect(card(page, "CS")).toContainText("Test draft");
  expect(payloads[0].evidence).toBeNull();
  await card(page, "ANTH").getByRole("button", { name: "Generate accountability packet" }).click();
  await expect(card(page, "ANTH")).toContainText("Test draft");
  expect(payloads[1].evidence).toBeTruthy();
});

test("legacy generic combined reports still reopen without a guessed department", async ({ page }) => {
  await seed(page, [report("Combined syllabus (3 pieces)")]);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Term view \(1 syllabus\)/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "By department" })).toHaveCount(0);
  await page.getByRole("button", { name: "Combined syllabus (3 pieces)", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Overall read" })).toBeVisible();
});

for (const school of [undefined, "Another University"]) {
  test(`Anthropology with ${school ?? "unknown school"} never displays or submits UO department evidence`, async ({ page }) => {
    await seed(page, [report("ANTH145.pdf", school)]);
    let submitted: { evidence: unknown } | undefined;
    await page.route("**/api/departments/packet", async (route) => {
      submitted = route.request().postDataJSON();
      await route.fulfill({ json: { packet: { letter: "No UO quotation", citedQuotes: [], evidenceQuote: null } } });
    });
    await page.goto("/");
    await expect(card(page, "ANTH")).toBeVisible();
    await expect(card(page, "ANTH").locator("blockquote")).toHaveCount(0);
    await card(page, "ANTH").getByRole("button", { name: "Generate accountability packet" }).click();
    await expect(card(page, "ANTH")).toContainText("No UO quotation");
    expect(submitted?.evidence).toBeNull();
  });
}

test("invalid course identifiers block analysis and a failed audit preserves a valid identifier for retry", async ({ page }) => {
  let calls = 0;
  await page.route("**/api/audit", async (route) => {
    calls++;
    if (calls === 1) return route.fulfill({ status: 503, json: { error: { message: "Synthetic outage; retry." } } });
    await route.fulfill({ json: { report: report(route.request().postDataJSON().fileName) } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: /Combine pieces instead/ }).click();
  await page.getByLabel("Course code (optional)").fill("Anthropology");
  await page.getByLabel(/Label \(e.g./).fill("Overview");
  await page.getByLabel("Text for piece 1").fill("Late work is not accepted. ".repeat(12));
  await page.getByRole("button", { name: "Audit combined syllabus", exact: true }).click();
  await expect(page.locator("main p[role=alert]")).toContainText("Enter a course code");
  expect(calls).toBe(0);
  await page.getByLabel("Course code (optional)").fill("anth341");
  await page.getByRole("button", { name: "Audit combined syllabus", exact: true }).click();
  await expect(page.locator("main p[role=alert]")).toContainText("Synthetic outage");
  await expect(page.getByLabel("Course code (optional)")).toHaveValue("anth341");
  await page.getByRole("button", { name: "Audit combined syllabus", exact: true }).click();
  await expect(page.getByRole("button", { name: "Back to term view" })).toBeVisible();
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), STORE);
  expect(saved[0].report.courseCode).toBe("ANTH 341");
  expect(calls).toBe(2);
});
