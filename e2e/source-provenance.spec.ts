import { expect, test, type Page } from "@playwright/test";
import type { AuditReport, Page as SourcePage, Passage } from "../lib/types";

// Synthetic course material only. Every analysis, research and fix request is intercepted.
const KEY = "da-syllabus-auditor.courses.v1";
const LABELS = ["Course information", "Schedule sort of"];
const TEXTS = [
  "Late work is not accepted. The final paper is due in week 4.",
  "The final paper is due in week 5. Office hours are Wednesday at noon.",
];
const NAME = "Combined syllabus (2 pieces)";

function pages(legacy = false): SourcePage[] {
  return TEXTS.map((text, i) => ({ pageNumber: i + 1, text, source: LABELS[i], ...(legacy ? {} : { sourcePageNumber: 1 }) }));
}

function fixtureReport(sourcePages: SourcePage[]): AuditReport {
  function passage(id: string, page: number, text: string): Passage {
    const start = sourcePages[page - 1].text.indexOf(text);
    if (start < 0) throw new Error("Invalid synthetic citation fixture");
    return { id, page, start, end: start + text.length, text };
  }
  const passages = [
    passage("late", 1, "Late work is not accepted."),
    passage("first", 1, "The final paper is due in week 4."),
    passage("second", 2, "The final paper is due in week 5."),
    passage("office", 2, "Office hours are Wednesday at noon."),
  ];
  return {
    fileName: NAME, pageCount: 2, sources: LABELS.map((label) => ({ label, pageCount: 1 })),
    coverage: { status: "full", skipped: [] },
    dimensions: [{ dimension: "transparency", title: "Transparency", status: "mixed", positive: 0, negative: 1,
      hits: [{ code: "T7", label: "The printed paper deadlines disagree", polarity: -1, passageId: "first", pairedPassageId: "second" }] }],
    flags: [{ kind: "late", severity: "high", explanation: "Late work is not accepted.", passageId: "late" }],
    assessments: [], passages, biggestRiskIndex: 0,
    overall: { label: null, reason: "Insufficient dimensions in this synthetic fixture.", included: 1, score: 0 },
    policyCheck: {
      school: "University of Oregon", checkedAt: "2026-10-31T12:00:00Z", comparisonStatus: "complete",
      items: [{ topic: "late_work", relation: "matches", instructor: null, syllabusQuote: passages[0].text, syllabusPage: 1,
        schoolQuote: "Synthetic school reference: state the late work policy.", schoolUrl: "https://provost.uoregon.edu/example-fixture" }],
      requiredContents: {
        context: { term: "fall", year: 2026, level: "undergraduate", coreEducation: "no" },
        snapshotDate: "2026-10-27", coverage: { status: "full", skipped: [] },
        groups: [{ id: "office", label: "Office hours", components: [{
          id: "office_hours", label: "Scheduled office hours", status: "found", applicability: "current_snapshot",
          passages: [passages[3]], policyQuote: "Synthetic requirement: state office hours.",
          policyUrl: "https://provost.uoregon.edu/example-fixture", question: "When are office hours?",
        }] }],
      },
    },
  };
}

async function intercept(page: Page) {
  const unexpected: string[] = [];
  await page.route("**/api/**", async (route) => {
    unexpected.push(new URL(route.request().url()).pathname);
    await route.fulfill({ status: 503, json: { error: { message: "Unexpected analysis request: blocked by test." } } });
  });
  await page.route("**/rest/v1/**", (route) => route.abort());
  await page.route("**/auth/v1/**", (route) => route.abort());
  return unexpected;
}

async function openSaved(page: Page, legacy = false) {
  const unexpected = await intercept(page);
  const sourcePages = pages(legacy);
  const report = fixtureReport(sourcePages);
  await page.addInitScript(({ key, course }) => {
    if (localStorage.getItem("source-provenance-seeded")) return;
    localStorage.setItem("source-provenance-seeded", "yes");
    localStorage.setItem(key, JSON.stringify([course]));
  }, { key: KEY, course: { id: "synthetic-provenance", pages: sourcePages, report } });
  await page.goto("/");
  await page.getByRole("button", { name: NAME, exact: true }).click();
  await expect(page.getByRole("heading", { name: "Overall read", exact: true })).toBeVisible();
  return unexpected;
}

function locator(index: number, legacy = false) {
  return legacy ? `${LABELS[index]}, combined page ${index + 1}` : `${LABELS[index]}, page 1 (combined page ${index + 1})`;
}

for (const legacy of [false, true]) {
  test(`${legacy ? "legacy" : "new"} saved combined report keeps source locators in context, policy, contents, fixes and print`, async ({ page }) => {
    const unexpected = await openSaved(page, legacy);
    const first = locator(0, legacy), second = locator(1, legacy);
    const article = page.locator("article.report");
    await expect(article.locator(".overall")).toContainText(first);
    const conflict = article.locator(".card").filter({ has: page.getByRole("heading", { name: /^Transparency:/ }) });
    await expect(conflict.locator(".where").nth(0)).toContainText(first);
    await expect(conflict.locator(".where").nth(1)).toContainText(second);
    await conflict.getByRole("button", { name: "See in context" }).nth(1).click();
    await expect(conflict.locator("pre.context mark").nth(1)).toHaveText("The final paper is due in week 5.");
    await expect(conflict.getByText(`Context from ${second}`, { exact: true })).toBeVisible();
    const comparison = article.locator("section").filter({ has: page.getByRole("heading", { name: "Against your school’s own policies", exact: true }) });
    await expect(comparison.locator("blockquote .where").first()).toHaveText(`This syllabus, ${first}`);
    const contents = page.getByRole("region", { name: "Required syllabus contents" });
    await contents.locator("summary").click();
    await expect(contents.locator("blockquote .where").first()).toHaveText(`This syllabus, ${second}`);
    // Reopening must not initiate a fresh audit, policy check, lookup, or fix call.
    expect(unexpected).toEqual([]);

    await page.route("**/api/fixes", async (route) => {
      const body = route.request().postDataJSON();
      await route.fulfill({ json: { kits: body.findings.map((f: { id: string }) => ({ id: f.id, questions: ["Which deadline should I follow?"], request: "", rewrite: null })) } });
    });
    await page.getByRole("button", { name: "Get fixes", exact: true }).click();
    const fixes = page.locator("#fixes");
    await expect(fixes.locator("blockquote .where").nth(0)).toHaveText(first);
    await expect(fixes.locator("blockquote .where").nth(1)).toHaveText(second);
    await page.emulateMedia({ media: "print" });
    await expect(contents.locator("blockquote .where").first()).toBeVisible();
    await expect(fixes.locator("blockquote .where").nth(1)).toBeVisible();
    await page.emulateMedia({ media: "screen" });
    await page.reload();
    await page.getByRole("button", { name: NAME, exact: true }).click();
    await expect(page.locator("article.report .overall")).toContainText(first);
    const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), KEY);
    expect(stored[0].pages).toEqual(pages(legacy));
    expect(unexpected).toEqual([]);
  });
}

test("combining labeled pasted pieces retains input provenance through a failed audit and retry", async ({ page }) => {
  const unexpected = await intercept(page);
  let calls = 0;
  await page.route("**/api/audit", async (route) => {
    const body = route.request().postDataJSON();
    expect(body.pages).toEqual(pages());
    calls++;
    if (calls === 1) return route.fulfill({ status: 503, json: { error: { message: "Synthetic analysis outage. Please retry." } } });
    return route.fulfill({ json: { requestId: body.requestId, report: fixtureReport(body.pages) } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: /Combine pieces instead/i }).click();
  await page.getByLabel("Label (e.g. “Grading policy page”)").fill(LABELS[0]);
  await page.getByLabel("Text for piece 1", { exact: true }).fill(TEXTS[0]);
  await page.getByRole("button", { name: "Add another piece", exact: true }).click();
  await page.getByLabel("Label (e.g. “Grading policy page”)").nth(1).fill(LABELS[1]);
  await page.getByLabel("Text for piece 2", { exact: true }).fill(TEXTS[1]);
  await page.getByRole("button", { name: "Audit combined syllabus", exact: true }).click();
  await expect(page.locator("main p[role=alert]")).toHaveText("Synthetic analysis outage. Please retry.");
  await expect(page.getByLabel("Text for piece 1", { exact: true })).toHaveValue(TEXTS[0]);
  await expect(page.getByLabel("Text for piece 2", { exact: true })).toHaveValue(TEXTS[1]);
  await page.getByRole("button", { name: "Audit combined syllabus", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Overall read", exact: true })).toBeVisible();
  await expect(page.locator("article.report .overall")).toContainText(locator(0));
  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), KEY);
  expect(stored[0].pages).toEqual(pages());
  expect(calls).toBe(2);
  expect(unexpected).toEqual([]);
});
