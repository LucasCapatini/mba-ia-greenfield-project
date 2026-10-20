import { expect, test } from "@playwright/test";

import { newSignedInUser, publishVideo } from "./support/stack";

// Publishing and discovery against the real stacks: studio upload → worker processing → publish →
// the video shows on the home and in /results?q=<title> → the watch page plays it and registers a
// view (home-search-production/TD-06).
test.describe("publish-and-discover", () => {
  test("a published video is found on the home and by search, and plays", async ({ browser }) => {
    const { page: creator } = await newSignedInUser(browser, "creator");
    const { title, publicId } = await publishVideo(creator, "discover");

    const viewer = await (await browser.newContext()).newPage();
    await viewer.goto("/");
    const homeCard = viewer.locator("article[data-slot='video-card']").filter({ hasText: title });
    await expect(homeCard).toHaveCount(1);

    await viewer.goto(`/results?q=${encodeURIComponent(title)}`);
    await expect(viewer.getByRole("heading", { level: 1 })).toHaveText(`Results for “${title}”`);
    const resultCard = viewer.locator("article[data-slot='video-card']").filter({ hasText: title });
    await expect(resultCard).toHaveCount(1);

    await resultCard.locator("h3").click();
    await expect(viewer).toHaveURL(new RegExp(`/watch/${publicId}$`));
    await expect(viewer.getByRole("heading", { level: 1, name: title })).toBeVisible();

    const view = viewer.waitForResponse(
      (response) =>
        response.request().method() === "POST" && new URL(response.url()).pathname === `/api/videos/${publicId}/views`,
    );
    await viewer.getByRole("button", { name: "Play" }).click();
    expect((await view).status()).toBe(204);
    await expect
      .poll(() => viewer.locator("video").evaluate((video: HTMLVideoElement) => video.currentTime))
      .toBeGreaterThan(0);
  });
});
