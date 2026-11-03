import { expect, test } from "@playwright/test";
import path from "node:path";

const fixture = (name: string) => path.join(__dirname, "fixtures", name);
test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", (route) => route.fulfill({ status: 503, json: { error: { message: "Synthetic outage. Please retry." } } }));
  await page.route("**/auth/v1/**", (route) => route.abort());
  await page.route("**/rest/v1/**", (route) => route.abort());
});

test("PDF selection reviews local pages before deliberate analysis and preserves failed work", async ({ page }) => {
  let calls = 0;
  await page.route("**/api/audit", (route) => {
    calls++;
    return route.fulfill({ status: 503, json: { error: { message: "Synthetic outage. Please retry." } } });
  });
  await page.goto("/");
  await page.getByLabel("Upload syllabus PDF").setInputFiles(fixture("syllabus.pdf"));
  // Term is required before Audit (commit 0f43c24); this fixture's name and text carry no
  // inferable term, so the student picks one like the term picker asks them to.
  await page.locator("fieldset.term-picker select").first().selectOption("fall");
  const review = page.getByRole("region", { name: "Source review" });
  await expect(review).toContainText("syllabus.pdf");
  await expect(review).toContainText("1 page");
  expect(calls).toBe(0);
  await page.getByRole("button", { name: "Audit syllabus", exact: true }).click();
  await expect(page.locator("p[role=alert]")).toContainText("Synthetic outage");
  await expect(review).toContainText("syllabus.pdf");
  await page.getByRole("button", { name: "Audit syllabus", exact: true }).click();
  await expect.poll(() => calls).toBe(2);
});

test("scanned selection discloses OCR without transmitting images until asked", async ({ page }) => {
  let ocr = 0;
  await page.route("**/api/ocr", (route) => {
    ocr++;
    return route.fulfill({ status: 503, json: { error: { message: "OCR unavailable" } } });
  });
  await page.goto("/");
  await page.getByLabel("Upload syllabus PDF").setInputFiles(fixture("blank.pdf"));
  await expect(page.getByRole("region", { name: "Source review" })).toContainText("OCR needed");
  expect(ocr).toBe(0);
  await page.locator("details.privacy-details").locator("summary").click();
  await expect(page.getByText(/page images are sent to Modal/)).toBeVisible();
  await page.getByRole("button", { name: "Read scanned pages", exact: true }).click();
  await expect(page.locator("p[role=alert]")).toContainText("Could not read this PDF");
  expect(ocr).toBe(1);
});

test("an audit that finishes while the student is on another screen is still saved", async ({ page }) => {
  // A slow audit: the student leaves before it lands, which used to abort the request and
  // discard the report entirely (the server had already spent the credits).
  await page.route("**/api/audit", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 4000));
    return route.fulfill({
      json: { report: { fileName: "Combined syllabus (1 piece)", pageCount: 1, coverage: { status: "full", skipped: [] }, dimensions: [], flags: [], assessments: [], passages: [], biggestRiskIndex: null, overall: { label: null, reason: "", included: 0, score: 0 } } },
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Combine pieces instead" }).click();
  await page.getByLabel(/Label \(e.g./).fill("Course overview");
  await page.getByLabel("Text for piece 1").fill("Late work is not accepted. ".repeat(12));
  await page.locator("fieldset.term-picker select").first().selectOption("fall");
  await page.getByRole("button", { name: "Audit combined syllabus" }).click();
  // Leave the screen immediately; the audit is still in flight.
  await page.getByRole("link", { name: "Find funding" }).click();
  // The report arrives while the student is away and must land on the device.
  await page.waitForFunction(
    (key) => (JSON.parse(localStorage.getItem(key) ?? "[]") as unknown[]).length > 0,
    "da-syllabus-auditor.courses.v1",
    { timeout: 15000 },
  );
  await page.getByRole("link", { name: "Syllabus audit" }).click();
  await expect(page.getByRole("heading", { name: /Term view \(1 syllabus\)/ })).toBeVisible();
});
