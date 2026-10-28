import { test, expect } from "@playwright/test";

test("server-selected processor is disclosed and reviewed PDF provenance prints", async ({ page }) => {
  await page.route("**/api/**", (route) => route.fulfill({ status: 500, json: { error: { message: "No live model requests in this test" } } }));
  await page.addInitScript(() => {
    const provenance = { method: "reviewed_ocr", page: 3, region: [10, 20, 100, 50], extractionMethod: "ocr", reviewedAt: "2026-10-27T00:00:00Z", sourcePdfSha256: "a".repeat(64), artifactSha256: "b".repeat(64), imageSha256: "c".repeat(64) };
    localStorage.setItem("da-syllabus-auditor.courses.v1", JSON.stringify([{ id: "ocr-ui-test", pages: [{ pageNumber: 1, text: "Attendance is required." }], report: {
      fileName: "ocr-provenance-test.pdf", pageCount: 1, coverage: { status: "full", skipped: [] }, dimensions: [], flags: [], assessments: [], passages: [], biggestRiskIndex: null,
      overall: { label: null, reason: "No overall assessment.", included: 0, score: 0 },
      policyCheck: { school: "University of Oregon", checkedAt: "2026-10-27T00:00:00Z", items: [{ topic: "attendance", relation: "conflicts", syllabusPage: 1, syllabusQuote: "Attendance is required.", instructor: null, schoolQuote: "Faculty should state a reason-neutral attendance policy.", schoolUrl: "https://provost.uoregon.edu/policy.pdf#page=3", schoolProvenance: provenance }] },
    } }]));
  });
  await page.goto("/");
  await expect(page.getByText(/Extracted syllabus text is sent to (Meta|Baseten)/)).toBeVisible();
  await page.getByRole("button", { name: "ocr-provenance-test.pdf" }).click();
  await expect(page.getByText(/Reviewed document, PDF page 3; image region 10, 20, 100, 50/)).toBeVisible();
  await expect(page.getByRole("link", { name: "official page", exact: true })).toHaveAttribute("href", /#page=3$/);
  await page.emulateMedia({ media: "print" });
  await expect(page.getByText(/Reviewed document, PDF page 3/)).toBeVisible();
});
