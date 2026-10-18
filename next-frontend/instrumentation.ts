// Server-side MSW for E2E (see next-frontend/CLAUDE.md § "E2E architecture").
//
// Why the explicit `__mswFetch` seam: Next.js wraps `globalThis.fetch` with its
// own patched fetcher that closes over the fetch reference it captured at boot.
// Depending on how long `import("./mocks/server")` takes, that capture can
// happen before MSW's `listen()` replaces `globalThis.fetch`, in which case
// requests made through Next's wrapper bypass MSW entirely (observed as
// ECONNREFUSED against the real upstream). Publishing MSW's intercepted fetch
// lets `lib/api/upstream.ts` route upstream calls through it deterministically.
// In every other runtime the symbol is undefined and the regular fetch is used.
declare global {
  var __mswFetch: typeof fetch | undefined;
}

export async function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.MSW_ENABLED === "true"
  ) {
    const { server } = await import("./mocks/server");
    server.listen({ onUnhandledRequest: "bypass" });
    globalThis.__mswFetch = globalThis.fetch;
    // Visible in the dev-server log so E2E runs can confirm the upstream is faked.
    console.log("[msw] server-side mocking enabled (upstream NestJS is faked)");
  }
}
