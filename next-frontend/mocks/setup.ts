import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./server";
import { resetStudioStore } from "./store";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  // O store dos fixtures é mutável (PATCH, publish, DELETE) — cada teste começa do seed.
  resetStudioStore();
});
afterAll(() => server.close());
