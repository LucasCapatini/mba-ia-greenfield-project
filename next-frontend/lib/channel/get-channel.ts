import "server-only";
import { cache } from "react";

import { publicRead } from "@/lib/api/public-read";
import { upstream } from "@/lib/api/upstream";

/**
 * Public channel by nickname (`GET /channels/{nickname}` — video-channel-management/TD-07). Sent
 * through `publicRead`: with a session the `Bearer` fills `viewer_subscribed` (phase 06,
 * social-interactions/TD-04); anonymous or expired token → the public read. `cache()` shares one
 * upstream read per request between the segment layout (404 check), `generateMetadata` and the
 * page. `null` when the channel does not exist.
 */
export const getPublicChannel = cache(async (nickname: string) => {
  const { data } = await publicRead((headers) =>
    upstream.GET("/channels/{nickname}", {
      params: { path: { nickname } },
      headers,
    }),
  );
  return data ?? null;
});
