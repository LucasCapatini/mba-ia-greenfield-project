/** Mirrors the API rule for `q` (`GET /videos`: 2–100 characters after `trim` — home-search-production/TD-02). */
const SEARCH_QUERY_MIN_LENGTH = 2;
const SEARCH_QUERY_MAX_LENGTH = 100;

type SearchQuery =
  /** Missing, empty or whitespace-only — nothing to search: the page redirects home. */
  | { kind: "redirect" }
  /** Below the minimum — the page shows the rule without calling the API. */
  | { kind: "too-short"; q: string }
  | { kind: "search"; q: string };

/**
 * Normalizes `/results?q=` before any read (home-search-production/TD-02, Revisions 2026-10-20):
 * trims, rejects what the API would answer with `400 VALIDATION_ERROR` and caps the term at the
 * API maximum, so a long URL still searches instead of failing.
 */
function parseSearchQuery(raw: string | string[] | undefined): SearchQuery {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const q = (value ?? "").trim().slice(0, SEARCH_QUERY_MAX_LENGTH).trim();
  if (!q) return { kind: "redirect" };
  if (q.length < SEARCH_QUERY_MIN_LENGTH) return { kind: "too-short", q };
  return { kind: "search", q };
}

export { parseSearchQuery, SEARCH_QUERY_MIN_LENGTH, SEARCH_QUERY_MAX_LENGTH };
export type { SearchQuery };
