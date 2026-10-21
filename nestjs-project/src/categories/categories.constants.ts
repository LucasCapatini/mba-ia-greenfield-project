/**
 * Listing read rate (home-search-production/TD-01): the home re-reads the categories on every
 * chip click, so they follow the 60 req/min per visitor of the public listings instead of the
 * global 10 req/min of the throttler.
 */
export const CATEGORIES_THROTTLE = {
  default: { limit: 60, ttl: 60_000 },
} as const;
