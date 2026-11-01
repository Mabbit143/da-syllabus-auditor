import { expect, test, type Page } from "@playwright/test";
import type { AuditReport, Page as SourcePage, Passage } from "../lib/types";

// Task 2 RED: quotes hidden until disclosure is opened, no extra network request on expand
const KEY = "da-syllabus-auditor.courses.v1";
const LABELS = ["Course information", "Schedule sort of"];
const TEXTS = [
  "Late work is not accepted. The final paper is due in week 4.",
  "The final paper is due in week 5. Office hours are Wednesday at noon.",
];
const NAME = "Combined syllabus (2 pieces)";

function pages(): SourcePage[] {
  return TEXTS.map((text, i) => ({ pageNumber: i + 1, text, source: LABELS[i], sourcePageNumber: 1 }));
}

function fixtureReport(sourcePages: SourcePage[]): AuditReport {
  function passage(id: string, page: number, text: string): Passage {
    const start = sourcePages[page - 1].text.indexOf(text);
    return { id, page, start, end: start + text.length, text };
  }
  const passages = [
    passage("late", 1, "Late work is not accepted."),
    passage("first", 1, "The final paper is due in week 4."),
    passage("second", 2, "The final paper is due in week 5."),
    passage("office", 2, "Office hours are Wednesday at noon."),
  ];
  return {
    fileName: NAME,
    pageCount: 2,
    sources: LABELS.map((label) => ({ label, pageCount: 1 })),
    coverage: { status: "full", skipped: [] },
    dimensions: [
      {
        dimension: "transparency",
        title: "Transparency",
        status: "mixed",
        positive: 0,
        negative: 1,
        hits: [{ code: "T7", label: "The printed paper deadlines disagree", polarity: -1, passageId: "first", pairedPassageId: "second" }],
      },
    ],
    flags: [{ kind: "late", severity: "high", explanation: "Late work is not accepted.", passageId: "late" }],
    assessments: [],
    passages,
    biggestRiskIndex: 0,
    overall: { label: null, reason: "Insufficient dimensions in this synthetic fixture.", included: 1, score: 0 },
    policyCheck: {
      school: "University of Oregon",
      checkedAt: "2026-10-31T12:00:00Z",
      comparisonStatus: "complete",
      items: [
        {
          topic: "late_work",
          relation: "matches",
          instructor: null,
          syllabusQuote: passages[0].text,
          syllabusPage: 1,
          schoolQuote: "Synthetic school reference: state the late work policy.",
          schoolUrl: "https://provost.uoregon.edu/example-fixture",
        },
      ],
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

test("syllabus wording is hidden until disclosure is opened, and opening triggers no fetch", async ({ page }) => {
  const unexpected = await intercept(page);
  const sourcePages = pages();
  const report = fixtureReport(sourcePages);
  await page.addInitScript(
    ({ key, course }) => {
      localStorage.setItem(key, JSON.stringify([course]));
    },
    { key: KEY, course: { id: "report-ux-task2", pages: sourcePages, report } },
  );
  await page.goto("/");
  await page.getByRole("button", { name: NAME, exact: true }).click();
  await expect(page.getByRole("heading", { name: "Overall read", exact: true })).toBeVisible();

  // The exact quotation should be inside a collapsed disclosure initially
  const details = page.locator("details.evidence-details").first();
  await expect(details).toBeVisible();
  // When closed, the blockquote text is not visible to user
  await expect(details.locator("blockquote").first()).toBeHidden();

  // Open via keyboard on the summary
  const summary = details.locator("summary").first();
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(details.locator("blockquote").first()).toBeVisible();
  await expect(details).toHaveAttribute("open", "");

  // No network request was caused by expanding
  expect(unexpected).toEqual([]);
});
