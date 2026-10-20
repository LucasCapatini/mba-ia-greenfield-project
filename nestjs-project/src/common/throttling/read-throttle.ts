/**
 * High-frequency reads — 60 req/min per visitor, the budget of the public listings
 * (home-search-production/TD-01) instead of the global 10/min per route:
 * - watch page and studio processing poll: `GET /videos/{publicId}`, `/playback`, `/related` and
 *   `GET /videos/{publicId}/comments` (the 3 s poll of video-channel-management/TD-12 alone exceeds
 *   10/min, and so does a visitor opening more than ten videos in a minute);
 * - `GET /me/subscriptions`, read by the app layout on every page with a session (side menu).
 * Found by the full-stack suite (SI-07.18).
 */
export const READ_THROTTLE = {
  default: { limit: 60, ttl: 60_000 },
} as const;
