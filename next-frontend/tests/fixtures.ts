import { test as base, expect, type Page } from "@playwright/test";

type NetworkFixtures = {
  network: void;
};

// MSW runs server-side in the containerized Next.js dev server via
// instrumentation.ts (MSW_ENABLED=true). This fixture is auto-applied to
// every E2E test to document that contract. Rules:
//   - Do NOT page.route() /api/** — it short-circuits real Route Handlers.
//   - Do NOT reach the real NestJS API — upstream is faked by mocks/ handlers.
//   - Per-scenario outcomes use reserved trigger fixtures in shared handlers
//     (e.g. "conflict@example.com" → 409); no per-test server.use() here.
export const test = base.extend<NetworkFixtures>({
  network: [async ({}, use) => { await use(); }, { auto: true }],
});

/**
 * Waits until React has hydrated the element matching `selector` (it attaches `__reactFiber…`
 * keys to DOM nodes when hydrating). Interacting with SSR markup before that races with
 * hydration — e.g. a `fill()` merged with the restored default value. `networkidle` is not a
 * substitute: pages with polling or a <video> preview never go idle.
 */
export async function waitForHydration(page: Page, selector = "main"): Promise<void> {
  await page.waitForFunction((target) => {
    const element = document.querySelector(target);
    return element !== null && Object.keys(element).some((key) => key.startsWith("__reactFiber"));
  }, selector);
}

export { expect };
