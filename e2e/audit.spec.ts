import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

// The Meta API is always mocked: tests cost no credits and need no key.
const fixture = (name: string) => path.join(__dirname, "fixtures", name);

function mockReport(fileName: string, week: number) {
  const passage = (id: string, text: string) => ({ id, page: 1, start: 0, end: text.length, text });
  const dim = (dimension: string, title: string, status: string, hits: object[] = []) => ({
    dimension, title, status,
    positive: hits.filter((h: any) => h.polarity === 1).length,
    negative: hits.filter((h: any) => h.polarity === -1).length,
    hits,
  });
  return {
    fileName,
    pageCount: 1,
    coverage: { status: "full", skipped: [] },
    dimensions: [
      dim("transparency", "Transparency", "strong", [
        { code: "T1", label: "Grade weights or percentages stated", polarity: 1, passageId: "p1" },
        { code: "T4", label: "Contact, office hours or response time stated", polarity: 1, passageId: "p2" },
      ]),
      dim("punitive", "Punitive vs. flexible", "weak", [
        { code: "F5", label: "Late work penalized, zero credit or not accepted", polarity: -1, passageId: "p3" },
        { code: "F6", label: "\"No exceptions\" or no make-up stated", polarity: -1, passageId: "p4" },
      ]),
      dim("accessibility", "Accessibility in practice", "not_found"),
      dim("perspectives", "Whose perspectives are in the room", "not_assessed"),
      dim("hidden", "Hidden curriculum", "mixed", [
        { code: "H3", label: "Weekly workload or how to succeed stated", polarity: 1, passageId: "p2" },
      ]),
    ],
    flags: [{ kind: "late", severity: "high", explanation: "Late work gets zero credit or is not accepted.", passageId: "p3" }],
    assessments: [
      { what: "Midterm", week, percent: 25, passageId: "p1" },
      { what: "Quiz", week, percent: null, passageId: "p1" },
      { what: "Paper", week, percent: 30, passageId: "p1" },
    ],
    biggestRiskIndex: 0,
    overall: { label: "mixed", reason: "Based on 4 of 5 dimensions: +0 (Strong minus Weak).", included: 4, score: 0 },
    passages: [
      passage("p1", "Midterm 25 percent"),
      passage("p2", "I reply to email within 48 hours"),
      passage("p3", "Late work is not accepted"),
      passage("p4", "No exceptions are made"),
    ],
  };
}

async function mockAudit(page: Page, week = 5) {
  await page.route("**/api/audit", async (route) => {
    const body = route.request().postDataJSON();
    await route.fulfill({ json: { requestId: body.requestId, report: mockReport(body.fileName, week) } });
  });
}

async function upload(page: Page, file: string) {
  await page.getByLabel("Upload syllabus PDF").setInputFiles(fixture(file));
}

test("a student uploads a syllabus and reads a verified audit", async ({ page }) => {
  await mockAudit(page);
  await page.goto("/");
  await upload(page, "syllabus.pdf");

  await expect(page.getByRole("heading", { name: "Overall read" })).toBeVisible();
  await expect(page.getByText("mixed", { exact: true }).first()).toBeVisible();
  await expect(page.locator("p", { hasText: "Biggest risk:" })).toContainText("Late work gets zero credit");
  for (const title of ["Transparency", "Punitive vs. flexible", "Accessibility in practice", "Whose perspectives are in the room", "Hidden curriculum"]) {
    await expect(page.getByRole("heading", { name: new RegExp(`^${title}`) })).toBeVisible();
  }
  await expect(page.getByText("Not found in this syllabus")).toBeVisible();
  await expect(page.getByText("Verified").first()).toBeVisible();

  // The student can check the quote against the page it came from.
  await page.getByRole("button", { name: "See in context" }).first().click();
  await expect(page.locator("pre.context mark").first()).toBeVisible();
});

test("two syllabi show a term view with a crunch week, saved across reloads", async ({ page }) => {
  await mockAudit(page, 5);
  await page.goto("/");
  await upload(page, "syllabus.pdf");
  await page.getByRole("button", { name: "Back to term view" }).click();
  await upload(page, "syllabus.pdf");
  await page.getByRole("button", { name: "Back to term view" }).click();

  await expect(page.getByRole("heading", { name: /Term view \(2 syllabi\)/ })).toBeVisible();
  await expect(page.locator(".week.crunch")).toHaveCount(1);
  await expect(page.locator(".week.crunch")).toContainText("W5");

  await page.reload();
  await expect(page.getByRole("heading", { name: /Term view \(2 syllabi\)/ })).toBeVisible();

  await page.getByRole("button", { name: "Remove" }).first().click();
  await expect(page.getByRole("heading", { name: /Term view \(1 syllabus\)/ })).toBeVisible();
});

test("a non-PDF is rejected with a plain message", async ({ page }) => {
  await page.goto("/");
  await upload(page, "notes.txt");
  await expect(page.locator("p[role=alert]")).toHaveText("Please choose a PDF file.");
});

test("a PDF with no readable text fails plainly and never calls the API", async ({ page }) => {
  let called = false;
  await page.route("**/api/audit", (route) => {
    called = true;
    return route.abort();
  });
  await page.goto("/");
  await upload(page, "blank.pdf");
  await expect(page.locator("p[role=alert]")).toHaveText("Could not read text from this file.");
  expect(called).toBe(false);
});

test("an API failure shows a readable error and the student can retry", async ({ page }) => {
  await page.route("**/api/audit", (route) =>
    route.fulfill({ status: 500, json: { error: { code: "audit_failed", message: "The audit could not be completed. Please try again." } } }),
  );
  await page.goto("/");
  await upload(page, "syllabus.pdf");
  await expect(page.locator("p[role=alert]")).toHaveText("The audit could not be completed. Please try again.");
  await expect(page.getByLabel("Upload syllabus PDF")).toBeEnabled();
});
