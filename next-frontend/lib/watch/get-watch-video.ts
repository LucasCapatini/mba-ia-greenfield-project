import "server-only";
import { cache } from "react";

import { publicRead } from "@/lib/api/public-read";
import { upstream } from "@/lib/api/upstream";

/**
 * The watch page video (`GET /videos/{publicId}`), read with the optional session
 * (video-channel-management/TD-07): the owner sees any status, everyone else only `published`.
 * `cache()` shares one upstream read per request between `generateMetadata` and the page.
 * `null` on 404 (unknown id or someone else's draft — the page renders `not-found`).
 */
export const getWatchVideo = cache(async (publicId: string) => {
  const { data, response } = await publicRead((headers) =>
    upstream.GET("/videos/{publicId}", { params: { path: { publicId } }, headers })
  );
  if (response.status === 404) {
    return null;
  }
  if (!data) {
    throw new Error(`GET /videos/${publicId} failed with ${response.status}`);
  }
  return data;
});
