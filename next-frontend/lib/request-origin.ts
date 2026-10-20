import "server-only";

import { headers } from "next/headers";

/** Public origin of the app as the browser sees it (shareable `/watch/{publicId}` links). */
export async function requestOrigin(): Promise<string> {
  const list = await headers();
  const host = list.get("x-forwarded-host") ?? list.get("host") ?? "localhost:3001";
  const protocol = list.get("x-forwarded-proto") ?? "http";
  return `${protocol}://${host}`;
}
