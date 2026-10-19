import "server-only";
import { cache } from "react";

import { upstream } from "@/lib/api/upstream";

/**
 * Public channel by nickname (`GET /channels/{nickname}`, anonymous — video-channel-management/TD-07).
 * `cache()` shares one upstream read per request between the segment layout (404 check),
 * `generateMetadata` and the page. `null` when the channel does not exist.
 */
export const getPublicChannel = cache(async (nickname: string) => {
  const { data } = await upstream.GET("/channels/{nickname}", {
    params: { path: { nickname } },
  });
  return data ?? null;
});
