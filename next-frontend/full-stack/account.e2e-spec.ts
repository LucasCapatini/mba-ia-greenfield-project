import { expect, test } from "@playwright/test";

import { login, signOut, signUpAndConfirm, uniqueUser } from "./support/stack";

// Account journey against the real stacks: sign up → confirmation link read from Mailpit →
// login → Sign Out from the account menu → login again (home-search-production/TD-06).
test.describe("account", () => {
  test("sign up, confirm by e-mail, sign in, sign out and sign in again", async ({ page, context }) => {
    const user = uniqueUser("account");

    await signUpAndConfirm(page, user);
    await login(page, user);
    const header = page.locator("[data-slot='app-header']");
    await expect(header.getByRole("button", { name: "Account" })).toBeVisible();
    expect((await context.cookies()).some((cookie) => cookie.name.includes("session"))).toBe(true);

    await signOut(page);
    await expect(page).toHaveURL(/\/$/);
    await expect(header.getByRole("link", { name: "Sign in" })).toBeVisible();
    await expect
      .poll(async () => (await context.cookies()).some((cookie) => cookie.name.includes("session")))
      .toBe(false);

    await login(page, user);
    await expect(header.getByRole("link", { name: "Upload video" })).toBeVisible();
  });
});
