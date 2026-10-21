import { expect, test } from "@playwright/test";

// Post-deploy smoke (home-search-production/TD-06, TD-11) — READ-ONLY: it runs against production
// on every deploy, so it never signs up users, sends e-mails nor creates videos.
// `npx playwright test -c playwright.full-stack.config.ts --grep @smoke`
// Optional `SMOKE_VIDEO_ID`: a published video whose watch page must play.
test.describe("smoke @smoke", () => {
  test("home answers with the grid or the empty state", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("navigation", { name: "Categories" })).toBeVisible();
    await expect(
      page.locator("article[data-slot='video-card']").first().or(page.getByText("No videos yet.")),
    ).toBeVisible();
  });

  test("search answers", async ({ page }) => {
    const response = await page.goto("/results?q=video");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Results for “video”");
  });

  test("login renders", async ({ page }) => {
    const response = await page.goto("/login");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });

  test("an existing video plays", async ({ page }) => {
    const videoId = process.env.SMOKE_VIDEO_ID;
    test.skip(!videoId, "SMOKE_VIDEO_ID not set");

    await page.goto(`/watch/${videoId}`);
    await page.getByRole("button", { name: "Play" }).click();
    await expect
      .poll(() => page.locator("video").evaluate((video: HTMLVideoElement) => video.currentTime))
      .toBeGreaterThan(0);
  });
});
