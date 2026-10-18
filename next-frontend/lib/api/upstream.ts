import "server-only";
import createClient from "openapi-fetch";
import type { paths } from "./types.gen";
import { env } from "@/lib/env";

// `fetch` is resolved at call time (never captured at module evaluation) so
// that request-time patches of `globalThis.fetch` apply to every layer that
// imports this client (Route Handlers and React Server Components alike).
// When server-side MSW is enabled (E2E), instrumentation.ts publishes the
// intercepted fetch as `globalThis.__mswFetch`; preferring it closes the race
// with Next.js' own fetch patch. In production the symbol is undefined.
export const upstream = createClient<paths>({
  baseUrl: env.API_URL,
  fetch: (input) => (globalThis.__mswFetch ?? globalThis.fetch)(input),
});
