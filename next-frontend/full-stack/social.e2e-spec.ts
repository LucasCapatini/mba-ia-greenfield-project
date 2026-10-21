import { expect, test } from "@playwright/test";

import { newSignedInUser, publishVideo } from "./support/stack";

// Social journey against the real stacks: a viewer comments, likes and subscribes to another
// user's channel, and the video lands in their subscriptions feed (home-search-production/TD-06).
test.describe("social", () => {
  test("comment, like and subscribe — the video shows in the subscriptions feed", async ({ browser }) => {
    const { page: creator } = await newSignedInUser(browser, "channel");
    const { title, publicId } = await publishVideo(creator, "social");
    const { page: viewer } = await newSignedInUser(browser, "viewer");

    await viewer.goto(`/watch/${publicId}`);
    await expect(viewer.getByRole("heading", { level: 1, name: title })).toBeVisible();
    // The channel is created at sign-up with a nickname derived from the name; read it from the page.
    const channelHref = await viewer.locator("main a[href^='/channel/']").first().getAttribute("href");
    expect(channelHref).toBeTruthy();

    const comment = `Comentário full-stack ${Date.now()}`;
    await viewer.getByLabel("Add a comment").click();
    await viewer.getByLabel("Add a comment").fill(comment);
    await viewer.getByRole("button", { name: "Comment", exact: true }).click();
    await expect(viewer.getByRole("list", { name: "Comments" })).toContainText(comment);

    const reactions = viewer.getByRole("group", { name: "Video reactions" });
    await reactions.getByRole("button", { name: /^Like, / }).click();
    await expect(reactions.getByRole("button", { name: "Like, 1" })).toHaveAttribute("aria-pressed", "true");

    await viewer.getByRole("button", { name: "Subscribe" }).click();
    await expect(viewer.getByRole("button", { name: "Subscribed" })).toHaveAttribute("aria-pressed", "true");

    // Everything was persisted: a reload reads it back from the API.
    await viewer.reload();
    await expect(viewer.getByRole("list", { name: "Comments" })).toContainText(comment);
    await expect(reactions.getByRole("button", { name: "Like, 1" })).toHaveAttribute("aria-pressed", "true");
    await expect(viewer.getByRole("button", { name: "Subscribed" })).toBeVisible();

    await viewer.goto("/feed/subscriptions");
    await expect(viewer.locator("article[data-slot='video-card']").filter({ hasText: title })).toHaveCount(1);
    await expect(
      viewer.getByRole("navigation", { name: "Main" }).locator(`a[href="${channelHref}"]`),
    ).toBeVisible();
  });
});
