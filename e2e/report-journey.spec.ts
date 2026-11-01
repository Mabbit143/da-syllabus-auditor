import { expect, test, type Page } from "@playwright/test";
import type { AuditReport, Page as SourcePage } from "../lib/types";

const KEY = "da-syllabus-auditor.courses.v1";
const NAME = "Journey syllabus.pdf";
const TEXT = "Late work is not accepted. Office hours are Wednesday at noon.";

function pages(): SourcePage[] {
  return [{ pageNumber: 1, text: TEXT }];
}

function report(): AuditReport {
  return {
    fileName: NAME,
    pageCount: 1,
    coverage: { status: "full", skipped: [] },
    dimensions: [
      { dimension: "transparency", title: "Transparency", status: "strong", positive: 2, negative: 0, hits: [] },
      { dimension: "punitive", title: "Punitive vs. flexible", status: "weak", positive: 0, negative: 2, hits: [] },
      { dimension: "accessibility", title: "Accessibility in practice", status: "not_found", positive: 0, negative: 0, hits: [] },
      { dimension: "perspectives", title: "Whose perspectives are in the room", status: "not_assessed", positive: 0, negative: 0, hits: [] },
      { dimension: "hidden", title: "Hidden curriculum", status: "mixed", positive: 1, negative: 0, hits: [] },
    ],
    flags: [],
    assessments: [],
    passages: [{ id: "p1", page: 1, start: 0, end: 8, text: "Late work" }],
    biggestRiskIndex: null,
    overall: { label: "mixed", reason: "Based on 3 of 5 areas.", included: 3, score: 0 },
  };
}

async function intercept(page: Page) {
  await page.route("**/api/**", async (route) => {
    await route.fulfill({ status: 503, json: { error: { message: "blocked" } } });
  });
  await page.route("**/rest/v1/**", (route) => route.abort());
  await page.route("**/auth/v1/**", (route) => route.abort());
}

test("saved report hides upload form and shows filename", async ({ page }) => {
  await intercept(page);
  const src = pages();
  const rpt = report();
  await page.addInitScript(
    ({ key, course }) => {
      localStorage.setItem(key, JSON.stringify([course]));
    },
    { key: KEY, course: { id: "journey-open", pages: src, report: rpt } },
  );
  await page.goto("/");
  await page.getByRole("button", { name: NAME, exact: true }).click();
  await expect(page.getByRole("heading", { name: "Overall read", exact: true })).toBeVisible();
  // Report heading / filename should be visible, upload form hidden
  await expect(page.getByRole("heading", { name: NAME, level: 2 })).toBeVisible();
  await expect(page.getByLabel("Upload syllabus PDF")).toBeHidden();
  // The report article should appear before the upload section in DOM order (no syllabus-input before it)
  const main = page.locator("main");
  const syllabusInput = main.locator(".syllabus-input");
  await expect(syllabusInput).toBeHidden();
});

test("upload view shows concise privacy notice, hides full disclosure until expanded", async ({ page }) => {
  await page.goto("/");
  // Concise notice visible
  await expect(page.getByText("Your file's text is sent to an AI service for this check.")).toBeVisible();
  // Full disclosure hidden initially (inside details)
  const details = page.locator("details.privacy-details");
  await expect(details).toBeVisible();
  await expect(details).not.toHaveAttribute("open", "");
  // The long disclosure text should be inside the details, hidden when closed
  const longText = details.locator("text=Muse Spark");
  // Might be hidden when details closed
  await expect(longText).toBeHidden();
  await details.locator("summary").click();
  await expect(details).toHaveAttribute("open", "");
  await expect(longText).toBeVisible();
});
