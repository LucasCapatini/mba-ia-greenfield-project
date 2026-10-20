import type { Channel, UpdateChannelInput } from "@/lib/api/contracts";
import { invalidBody, readJson, withSession } from "@/lib/api/bff";
import { upstream } from "@/lib/api/upstream";
import { getSession } from "@/lib/auth/session";

// PATCH /api/channel → PATCH /channels/me. Se o nickname ou o nome mudou, o `channelSlug` /
// `channelName` da sessão acompanham (per video-channel-management/TD-08;
// phase-02-auth-frontend/TD-02) e o cookie é reemitido uma vez.
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
  if (!session.isLoggedIn) {
    return response;
  }
  const nicknameChanged = channel.nickname !== session.channelSlug;
  const nameChanged = channel.name !== session.channelName;
  if (nicknameChanged || nameChanged) {
    session.channelSlug = channel.nickname;
    session.channelName = channel.name;
    await session.save();
  }
  return response;
}
