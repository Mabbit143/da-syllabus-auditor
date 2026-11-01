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
