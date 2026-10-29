import { expect, test } from "@playwright/test";

// The model is always mocked: tests cost no credits and need no key.
const result = (id: string) => ({
  id, label: "x", note: "",
  offices: [
    { office: "Office of Equal Opportunity and Access", contact: "eoa@uoregon.edu", quote: "The Office of Equal Opportunity and Access will make every effort to consider requests.", page: 1, source: "Religious Observance Policy", url: "https://provost.uoregon.edu/religious-observance", confirmedByBoth: true },
    { office: "Office of the Dean of Students", contact: "", quote: "Office of the Dean of Students [Care and Advocacy Program]", page: 1, source: "Student Grievance Policy", url: "https://provost.uoregon.edu/student-grievance-policy", confirmedByBoth: false },
  ],
  message: "Hello, I am a student at the University of Oregon and I would like to ask for accommodations. Thank you.",
});

test("a student picks a situation and sees the office, the exact words, and a message", async ({ page }) => {
  await page.route("**/api/navigator", (route) => route.fulfill({ json: result(route.request().postDataJSON().id) }));
  await page.goto("/navigator");
  await expect(page.getByRole("heading", { name: "Who do I go to?" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Show me who to go to" })).toHaveCount(5);
  await page.getByRole("button", { name: "Show me who to go to" }).nth(4).click();
  await expect(page.getByText("Office of Equal Opportunity and Access").first()).toBeVisible();
  await expect(page.getByText("eoa@uoregon.edu")).toBeVisible();
  await expect(page.getByText("Only one of two checks named this office.")).toBeVisible();
  await expect(page.getByRole("link", { name: "official page" }).first()).toHaveAttribute("href", /^https:\/\/provost\.uoregon\.edu\//);
  await expect(page.getByText("Hello, I am a student at the University of Oregon")).toBeVisible();
});

test("a failed lookup shows a readable error and the button works again", async ({ page }) => {
  await page.route("**/api/navigator", (route) => route.fulfill({ status: 502, json: { error: { message: "The offices could not be looked up. Please try again." } } }));
  await page.goto("/navigator");
  await page.getByRole("button", { name: "Show me who to go to" }).first().click();
  await expect(page.locator("p[role=alert]")).toHaveText("The offices could not be looked up. Please try again.");
  await expect(page.getByRole("button", { name: "Show me who to go to" }).first()).toBeEnabled();
});

test("the navigator is linked from the main navigation", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Who do I go to?" }).click();
  await expect(page).toHaveURL(/\/navigator$/);
});
