import { expect, test } from "@playwright/test";

// Synthetic saved course + mocked packet route: verifies UI rejection/retry only,
// not the live model or the server's semantic evidence gate.
test("a rejected packet shows no draft, retains the course, and can be retried without sending", async ({ page }) => {
  const name = "CS101-synthetic.pdf";
  const quote = "Late work is not accepted.";
  const unexpected: string[] = [];
  let calls = 0;
  await page.route("**/api/**", async (route) => {
    unexpected.push(new URL(route.request().url()).pathname);
    await route.fulfill({ status: 503, json: { error: { message: "Unexpected network call blocked by test." } } });
  });
  await page.route("**/rest/v1/**", (route) => route.abort());
  await page.route("**/auth/v1/**", (route) => route.abort());
  await page.addInitScript(({ name, quote }) => {
    localStorage.setItem("da-syllabus-auditor.courses.v1", JSON.stringify([{
      id: "synthetic-packet-course", pages: [{ pageNumber: 1, text: quote }], report: {
        fileName: name, pageCount: 1, coverage: { status: "full", skipped: [] }, dimensions: [],
        flags: [{ kind: "late", severity: "high", explanation: quote, passageId: "late" }],
        passages: [{ id: "late", page: 1, start: 0, end: quote.length, text: quote }], assessments: [],
        biggestRiskIndex: 0, overall: { label: null, reason: "Synthetic test", included: 0, score: 0 },
      },
    }]));
  }, { name, quote });
  await page.route("**/api/departments/packet", async (route) => {
    const body = route.request().postDataJSON();
    expect(body.courses).toHaveLength(1);
    expect(body.courses[0].report.fileName).toBe(name);
    expect(body.courses[0].report.passages[0].text).toBe(quote);
    calls++;
    if (calls === 1) return route.fulfill({ status: 502, json: { error: { code: "packet_failed", message: "Could not draft a letter grounded only in verified quotes. Please try again." } } });
    return route.fulfill({ json: { packet: {
      letter: `Please review this course's stated late policy: "${quote}" I would like to understand what options are available.`,
      citedQuotes: [{ course: name, quote, page: 1 }], evidenceQuote: null,
    } } });
  });
  await page.goto("/");
  const card = page.locator(".card").filter({ has: page.getByRole("heading", { name: /^CS \(/ }) });
  const generate = card.getByRole("button", { name: "Generate accountability packet", exact: true });
  await generate.click();
  await expect(card.locator("p[role=alert]")).toContainText("grounded only in verified quotes");
  await expect(card.locator(".draft")).toHaveCount(0);
  await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
  await expect(generate).toBeEnabled();
  await generate.click();
  await expect(card.locator(".draft")).toContainText(quote);
  await expect(card.locator("p[role=alert]")).toHaveCount(0);
  await expect(card.getByRole("listitem").filter({ hasText: name })).toHaveText(`${name}, page 1: “${quote}”`);
  await page.emulateMedia({ media: "print" });
  await expect(card.locator(".draft")).toBeVisible();
  await page.emulateMedia({ media: "screen" });
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("da-syllabus-auditor.courses.v1")!));
  expect(stored).toHaveLength(1);
  expect(stored[0].pages[0].text).toBe(quote);
  expect(calls).toBe(2);
  expect(unexpected).toEqual([]);
});
