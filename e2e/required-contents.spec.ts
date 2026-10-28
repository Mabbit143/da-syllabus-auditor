import { test, expect, type Page } from "@playwright/test";

const text = "Professor Robin teaches this course. Office hours are Monday at noon.";
const groups = ["Instructor information", "Office hours", "Course objectives", "Grading", "Absences", "Materials and activities", "Classroom behavior", "University policies and accommodations"];

async function seed(page: Page) {
  await page.route("**/api/**", (route) => route.fulfill({ status: 500, json: { error: { message: "Unexpected API request" } } }));
  await page.addInitScript(({ text }) => {
    if (localStorage.getItem("contents-test-seeded")) return;
    localStorage.setItem("contents-test-seeded", "true");
    const course = { id: "test-course", pages: [{ pageNumber: 1, text }], report: {
      fileName: "test-syllabus.pdf", pageCount: 1, coverage: { status: "full", skipped: [] },
      dimensions: [], flags: [], assessments: [], passages: [], biggestRiskIndex: null,
      overall: { label: null, reason: "No overall assessment.", included: 0, score: 0 },
      policyCheck: { school: "University of Oregon", checkedAt: "2026-10-27T00:00:00Z", items: [] },
    } };
    localStorage.setItem("da-syllabus-auditor.courses.v1", JSON.stringify([course]));
  }, { text });
  await page.goto("/");
  await page.getByRole("button", { name: "test-syllabus.pdf" }).click();
}

function response(context: object) {
  return { policies: [], items: [], newPolicies: false, requiredContents: {
    context, snapshotDate: "2026-10-27", coverage: { status: "full", skipped: [] as string[] },
    groups: groups.map((label, index) => ({ id: `g${index}`, label, components: [{
      id: `c${index}`, label: index === 0 ? "Instructor name" : "Component evidence",
      status: index === 0 ? "found" : index === 7 ? "not_applicable" : "not_assessed",
      applicability: index === 7 ? "not_applicable" : "historical_unverified",
      passages: index === 0 ? [{ id: "name", page: 1, start: 0, end: 35, text: "Professor Robin teaches this course." }] : [],
      policyQuote: "INSTRUCTOR INFORMATION: instructor name and contact information.",
      policyUrl: "https://provost.uoregon.edu/syllabus-requirement-undergraduate-and-graduate-policy",
      question: "Where can I find the instructor contact information?",
    }] })),
  } };
}

test("old report can run separate contents checks, retry, and print evidence", async ({ page }) => {
  await seed(page);
  const section = page.getByRole("region", { name: "Required syllabus contents" });
  await expect(section.getByLabel("Course term", { exact: true })).toHaveValue("unknown");
  await expect(section.getByLabel("Course level")).toHaveValue("unknown");
  await expect(section.getByLabel("Core Education course")).toHaveValue("unknown");
  await section.getByLabel("Course term", { exact: true }).selectOption("fall");
  await section.getByLabel("Course year").fill("2025");
  await section.getByLabel("Course level").selectOption("undergraduate");
  let fail = true;
  let writes = 0;
  await page.route("**/rest/v1/policy_gaps*", async (route) => { writes++; await route.abort(); });
  await page.route("**/api/policy-check", async (route) => {
    const body = route.request().postDataJSON();
    expect(body.contentsOnly).toBe(true);
    expect(body.coverage.status).toBe("full");
    if (fail) { fail = false; await route.fulfill({ status: 503, json: { error: { message: "Required contents unavailable. Please retry." } } }); }
    else await route.fulfill({ json: response(body.requiredContentsContext) });
  });
  await section.getByRole("button", { name: /check required contents/i }).click();
  await expect(section.getByRole("alert")).toContainText("Please retry");
  await section.getByRole("button", { name: /check required contents/i }).click();
  await expect(section.getByText(/Results for: fall 2025/i)).toBeVisible();
  for (const label of groups) await expect(section.getByText(label, { exact: true })).toBeVisible();
  await section.locator("summary").first().focus();
  await page.keyboard.press("Enter");
  await expect(section.getByText("Professor Robin teaches this course.", { exact: true })).toBeVisible();
  await expect(section.getByText("Historical applicability unverified", { exact: true }).first()).toBeVisible();
  await expect(section.getByText("Where can I find the instructor contact information?").first()).toBeVisible();
  await section.getByLabel("Course year").fill("2026");
  await expect(section.getByText(/Results for: fall 2025/i)).toBeVisible();
  await section.locator("summary").first().click();
  await page.emulateMedia({ media: "print" });
  await expect(section.getByText("Professor Robin teaches this course.", { exact: true })).toBeVisible();
  expect(writes).toBe(0);
  await page.emulateMedia({ media: "screen" });
  await page.reload();
  await page.getByRole("button", { name: "test-syllabus.pdf" }).click();
  await expect(page.getByText(/Results for: fall 2025/i)).toBeVisible();
});

test("late response does not overwrite a newer course-context result", async ({ page }) => {
  await seed(page);
  const section = page.getByRole("region", { name: "Required syllabus contents" });
  let release: (() => void) | undefined;
  const held = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/policy-check", async (route) => {
    const body = route.request().postDataJSON();
    if (body.requiredContentsContext.year === 2025) await held;
    await route.fulfill({ json: response(body.requiredContentsContext) }).catch(() => {});
  });
  await section.getByLabel("Course term", { exact: true }).selectOption("fall");
  await section.getByLabel("Course year").fill("2025");
  await section.getByRole("button", { name: /check required contents/i }).click();
  await expect(section.getByRole("status")).toBeVisible();
  // A course switch unmounts the controls; the pending request stays scoped to its course.
  await page.getByRole("button", { name: "Back to term view" }).click();
  release!();
  await page.getByRole("button", { name: "test-syllabus.pdf" }).click();
  await expect(section.getByText(/Results for: fall 2025/i)).toBeVisible();
  await section.getByLabel("Course year").fill("2026");
  await section.getByRole("button", { name: /check required contents/i }).click();
  await expect(section.getByText(/Results for: fall 2026/i)).toBeVisible();
});

test("partial contents results disclose skipped text and preserve ordinary findings", async ({ page }) => {
  await seed(page);
  await page.route("**/api/policy-check", async (route) => {
    const body = response(route.request().postDataJSON().requiredContentsContext);
    body.requiredContents.coverage = { status: "partial", skipped: ["Required contents batch 2 could not be assessed."] };
    await route.fulfill({ json: body });
  });
  const section = page.getByRole("region", { name: "Required syllabus contents" });
  await section.getByRole("button", { name: /check required contents/i }).click();
  await expect(section.getByText(/Partial assessment/)).toContainText("batch 2");
  await section.locator("summary").nth(1).click();
  await expect(section.getByText(/This does not establish that the content is absent/).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Overall read", exact: true })).toBeVisible();
});

test("a contents-only saved report still offers the ordinary policy comparison", async ({ page }) => {
  await seed(page);
  await page.evaluate(() => {
    const key = "da-syllabus-auditor.courses.v1";
    const courses = JSON.parse(localStorage.getItem(key)!);
    courses[0].report.policyCheck.comparisonStatus = "not_run";
    localStorage.setItem(key, JSON.stringify(courses));
  });
  await page.reload();
  await page.getByRole("button", { name: "test-syllabus.pdf" }).click();
  await expect(page.getByRole("button", { name: "Check against University of Oregon" })).toBeVisible();
});

