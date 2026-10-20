import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { expect, type Browser, type Page } from "@playwright/test";

// Helpers of the full-stack journeys (home-search-production/TD-06). Nothing here is faked: the
// confirmation link comes from the e-mail that reached Mailpit and the video is processed by the
// real worker. Every run creates its own users, so journeys never depend on each other.

const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://localhost:8025";
const PASSWORD = "Password1";

/** Short WebM/VP9 clip shared with the mocked suite (watch-page/TD-07). */
const SAMPLE_VIDEO = path.join(__dirname, "..", "..", "tests", "fixtures", "watch-sample.webm");

type TestUser = { name: string; email: string; password: string };

function uniqueUser(label: string): TestUser {
  const id = randomUUID().slice(0, 8);
  return {
    name: `Full Stack ${label} ${id}`,
    email: `full-stack-${label}-${id}@example.com`,
    password: PASSWORD,
  };
}

type MailpitSearch = { messages: Array<{ ID: string }> };
type MailpitMessage = { Text: string; HTML: string };

/** Polls Mailpit until the confirmation e-mail for `email` arrives and returns the link's path. */
async function confirmationPath(email: string): Promise<string> {
  const query = encodeURIComponent(`to:"${email}"`);
  let id: string | undefined;
  await expect
    .poll(
      async () => {
        const response = await fetch(`${MAILPIT_URL}/api/v1/search?query=${query}`);
        id = ((await response.json()) as MailpitSearch).messages[0]?.ID;
        return id;
      },
      { message: `confirmation e-mail for ${email} in Mailpit`, timeout: 30_000 },
    )
    .toBeTruthy();
  const message = (await (await fetch(`${MAILPIT_URL}/api/v1/message/${id}`)).json()) as MailpitMessage;
  const link = `${message.Text}\n${message.HTML}`.match(/https?:\/\/[^\s"'<>]+\/confirm-email\?token=[^\s"'<>&]+/)?.[0];
  if (!link) throw new Error(`No confirmation link in the e-mail sent to ${email}`);
  // The API builds the link from its FRONTEND_URL; follow it on the frontend under test.
  const url = new URL(link);
  return `${url.pathname}${url.search}`;
}

/** Signs up through the UI and confirms the account with the link read from Mailpit. */
async function signUpAndConfirm(page: Page, user: TestUser): Promise<void> {
  await page.goto("/signup");
  await page.getByLabel("Full Name").fill(user.name);
  await page.getByLabel("Email address").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByLabel("Confirm Password").fill(user.password);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("status")).toBeVisible();

  await page.goto(await confirmationPath(user.email));
  await expect(page.getByRole("heading", { level: 1, name: "Email confirmed" })).toBeVisible();
}

async function login(page: Page, user: TestUser): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("/");
  await expect(page.locator("[data-slot='app-header']")).toHaveAttribute("data-session", "authenticated");
}

async function signOut(page: Page): Promise<void> {
  await page.locator("[data-slot='app-header']").getByRole("button", { name: "Account" }).click();
  await page.getByRole("dialog", { name: "Account" }).getByRole("button", { name: "Sign Out" }).click();
  await expect(page.locator("[data-slot='app-header']")).toHaveAttribute("data-session", "anonymous");
}

/** A confirmed, logged-in user in a fresh browser context. */
async function newSignedInUser(browser: Browser, label: string): Promise<{ page: Page; user: TestUser }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  const user = uniqueUser(label);
  await signUpAndConfirm(page, user);
  await login(page, user);
  return { page, user };
}

/**
 * Uploads the sample clip through the studio, waits for the worker to process it and publishes it
 * with a unique title. Returns the title and the public id read from the upload URL.
 */
async function publishVideo(page: Page, label: string): Promise<{ title: string; publicId: string }> {
  const title = `Full stack ${label} ${randomUUID().slice(0, 8)}`;
  await page.goto("/studio/upload");
  await page.getByLabel("Select file").setInputFiles({
    name: "full-stack-sample.webm",
    mimeType: "video/webm",
    buffer: readFileSync(SAMPLE_VIDEO),
  });
  await page.waitForURL(/\/studio\/upload\/[^/]+$/);
  const publicId = new URL(page.url()).pathname.split("/").pop() ?? "";

  await expect(page.getByText("Ready", { exact: true })).toBeVisible({ timeout: 120_000 });
  // Processing settling triggers `router.refresh()`; "Checks complete" comes from the refreshed
  // props, so the form is stable from here (an earlier pick could be reset by the refresh).
  await expect(page.getByText(/^Checks complete/)).toBeVisible();
  const category = page.getByRole("combobox", { name: "Category" });
  await expect(async () => {
    if (!(await category.textContent())?.includes("Education")) {
      await page.keyboard.press("Escape");
      await category.click();
      await page.getByRole("option", { name: "Education" }).click({ timeout: 2_000 });
    }
    await expect(category).toContainText("Education", { timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  await page.getByRole("radio", { name: /Public/ }).check();
  await page.getByLabel("Title").fill(title);
  await expect(page.getByLabel("Title")).toHaveValue(title);
  await page.getByRole("button", { name: "Save Changes" }).click();
  await expect(page.getByText("Video published")).toBeVisible();
  return { title, publicId };
}

export { login, newSignedInUser, publishVideo, signOut, signUpAndConfirm, uniqueUser };
export type { TestUser };
