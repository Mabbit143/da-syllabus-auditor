import { expect, test } from "@playwright/test";

test("account creation points to the notice above when consent is unchecked", async ({ page }) => {
  let signUpRequests = 0;
  await page.route("**/auth/v1/**", (route) => {
    if (new URL(route.request().url()).pathname.endsWith("/signup")) signUpRequests++;
    return route.abort();
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Sign in to save" }).click();
  await page.getByLabel("Email", { exact: true }).fill("signup@example.test");
  await page.getByLabel("Password", { exact: true }).fill("test-only-password");
  await page.getByLabel("School (new accounts)", { exact: true }).fill("University of Oregon");
  await expect(page.getByRole("checkbox")).not.toBeChecked();

  await page.getByRole("button", { name: "Create account", exact: true }).click();

  await expect(page.locator(".authform").getByRole("alert")).toHaveText("Please confirm the notice above to create an account.");
  expect(signUpRequests).toBe(0);
});
