import type { Channel, UpdateChannelInput } from "@/lib/api/contracts";
import { invalidBody, readJson, withSession } from "@/lib/api/bff";
import { upstream } from "@/lib/api/upstream";
import { getSession } from "@/lib/auth/session";

// PATCH /api/channel → PATCH /channels/me. Se o nickname mudou, o `channelSlug` da sessão
// acompanha (per video-channel-management/TD-08; phase-02-auth-frontend/TD-02) e o cookie é
// reemitido.
export async function PATCH(request: Request) {
  const body = await readJson<UpdateChannelInput>(request);
  if (body === null) {
    return invalidBody();
  }
  const response = await withSession((headers) =>
    upstream.PATCH("/channels/me", { body, headers })
  );
  if (!response.ok) {
    return response;
  }
  const channel = (await response.clone().json()) as Channel;
  const session = await getSession();
  if (session.isLoggedIn && channel.nickname !== session.channelSlug) {
    session.channelSlug = channel.nickname;
    await session.save();
  }
  return response;
}
