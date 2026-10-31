import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const AUDITS_KEY = "da-syllabus-auditor.courses.v1";
const ACCOUNT_A = "11111111-1111-4111-8111-111111111111";
const ACCOUNT_B = "22222222-2222-4222-8222-222222222222";

function user(id: string) {
  return {
    id, aud: "authenticated", role: "authenticated",
    email: id === ACCOUNT_A ? "first@example.test" : "second@example.test",
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: { school: "University of Oregon" },
    created_at: "2026-10-01T00:00:00Z",
  };
}

function session(id: string) {
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return {
    access_token: `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: id, exp: expires, role: "authenticated" })}.test-signature`,
    token_type: "bearer", refresh_token: `test-refresh-${id}`,
    expires_in: 3600, expires_at: expires, user: user(id),
  };
}

function audit(id: string) {
  return {
    id, created_at: "2026-10-01T00:00:00Z",
    pages: [{ pageNumber: 1, text: "Private course text belonging only to the first account." }],
    report: {
      fileName: `${id}.pdf`, pageCount: 1, coverage: { status: "full", skipped: [] },
      dimensions: [], flags: [], assessments: [], passages: [], biggestRiskIndex: null,
      overall: { label: null, reason: "No overall assessment.", included: 0, score: 0 },
    },
  };
}

async function mockAccounts(context: BrowserContext, logoutFails = false) {
  let account = ACCOUNT_A;
  const insertedAudits: unknown[] = [];
  // All auth, database and analysis requests are intercepted; no real account or paid API is used.
  await context.route("**/auth/v1/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/token")) {
      account = route.request().postDataJSON().email === "first@example.test" ? ACCOUNT_A : ACCOUNT_B;
      return route.fulfill({ json: session(account) });
    }
    if (url.pathname.endsWith("/user")) return route.fulfill({ json: user(account) });
    if (url.pathname.endsWith("/logout")) {
      return logoutFails
        ? route.fulfill({ status: 503, json: { message: "Sign-out service unavailable. Please try again." } })
        : route.fulfill({ status: 204 });
    }
    return route.abort();
  });
  await context.route("**/rest/v1/**", async (route) => {
    const request = route.request();
    if (request.method() !== "GET") {
      if (new URL(request.url()).pathname.endsWith("/audits")) insertedAudits.push(request.postDataJSON());
      return route.fulfill({ status: 201, json: [] });
    }
    if (new URL(request.url()).pathname.endsWith("/audits")) {
      return route.fulfill({ json: account === ACCOUNT_A ? [audit("private-course-one"), audit("private-course-two")] : [] });
    }
    return route.fulfill({ json: [] });
  });
  await context.route("**/api/**", (route) => route.fulfill({ status: 503, json: { error: { message: "Analysis is mocked in this test." } } }));
  return insertedAudits;
}

async function signIn(page: Page, email: string) {
  await page.getByRole("button", { name: "Sign in to save" }).click();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("test-only-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeVisible();
}

test("sign-out clears private audits and does not import them into another account", async ({ page, context }) => {
  const insertedAudits = await mockAccounts(context);
  await page.goto("/");
  await signIn(page, "first@example.test");
  await expect(page.getByRole("heading", { name: "Term view (2 syllabi)" })).toBeVisible();
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), AUDITS_KEY)).not.toBeNull();
  await page.evaluate(() => {
    localStorage.setItem("da-syllabus-auditor.profile.v1", JSON.stringify({ major: "Private profile" }));
    localStorage.setItem("da-syllabus-auditor.oppstatus.v1", JSON.stringify({ private: "saved" }));
    localStorage.setItem("unrelated-setting", "keep-me");
  });

  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByRole("button", { name: "Sign in to save" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Term view (2 syllabi)" })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("da-syllabus-auditor.")))).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem("unrelated-setting"))).toBe("keep-me");

  await page.reload();
  await expect(page.getByRole("heading", { name: "Term view (2 syllabi)" })).toHaveCount(0);
  await signIn(page, "second@example.test");
  await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeVisible();
  await expect(page.getByText("private-course-one.pdf", { exact: true })).toHaveCount(0);
  expect(insertedAudits).toEqual([]);
});

test("signing out in another tab also removes the loaded private reports", async ({ page, context }) => {
  await mockAccounts(context);
  await page.goto("/");
  await signIn(page, "first@example.test");
  await expect(page.getByRole("heading", { name: "Term view (2 syllabi)" })).toBeVisible();

  const otherTab = await context.newPage();
  await otherTab.goto("/");
  await expect(otherTab.getByRole("heading", { name: "Term view (2 syllabi)" })).toBeVisible();
  await otherTab.getByRole("button", { name: "Sign out", exact: true }).click();

  for (const tab of [page, otherTab]) {
    await expect(tab.getByRole("button", { name: "Sign in to save" })).toBeVisible();
    await expect(tab.getByRole("heading", { name: "Term view (2 syllabi)" })).toHaveCount(0);
  }
});

test("an unavailable logout server still clears this device's private reports", async ({ page, context }) => {
  await mockAccounts(context, true);
  await page.goto("/");
  await signIn(page, "first@example.test");
  await expect(page.getByRole("heading", { name: "Term view (2 syllabi)" })).toBeVisible();

  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  // Supabase removes the local session even when remote token revocation fails.
  await expect(page.getByRole("button", { name: "Sign in to save" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Term view (2 syllabi)" })).toHaveCount(0);
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), AUDITS_KEY)).toBeNull();
});
