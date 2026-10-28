import { expect, test } from "@playwright/test";
import path from "node:path";

// Modal and Meta are always mocked: tests cost no credits and need no key.
const blank = path.join(__dirname, "fixtures", "blank.pdf");
const text = "Late assignments are handled on a case-by-case basis. Attendance is not formally graded. ".repeat(4);

test("a scanned PDF is read by OCR, audited, and labeled as OCR", async ({ page }) => {
  let audited: { pages?: { text: string }[] } = {};
  await page.route("**/api/ocr", (route) => route.fulfill({ json: { pages: [text] } }));
  await page.route("**/api/audit", async (route) => {
    audited = route.request().postDataJSON();
    await route.fulfill({
      json: { report: { fileName: "blank.pdf", pageCount: 1, coverage: { status: "full", skipped: [] }, dimensions: [], flags: [], assessments: [], passages: [], biggestRiskIndex: null, overall: { label: null, reason: "", included: 0, score: 0 } } },
    });
  });
  await page.route("**/api/policy-check", (route) => route.abort());
  await page.goto("/");
  await page.getByLabel("Upload syllabus PDF").setInputFiles(blank);
  await expect(page.getByText("read from page images by OCR")).toBeVisible();
  expect(audited.pages?.[0].text).toBe(text.trim());
});

test("when OCR is unavailable a scan still fails plainly", async ({ page }) => {
  await page.route("**/api/ocr", (route) => route.fulfill({ status: 503, json: { error: { message: "Reading scanned files is not available right now." } } }));
  await page.goto("/");
  await page.getByLabel("Upload syllabus PDF").setInputFiles(blank);
  await expect(page.locator("p[role=alert]")).toHaveText("Could not read text from this file.");
});
