import { withOptionalSession, type PublicIdContext } from "@/lib/api/bff";
import { upstream } from "@/lib/api/upstream";

// GET /api/videos/{publicId}/playback → GET /videos/{publicId}/playback (pass-through). Público: o
// player renova as URLs assinadas quando `stream_url` expira (watch-page/TD-05); o `Bearer` vai
// só quando há sessão e a regra de leitura fica no upstream (video-channel-management/TD-07).
export async function GET(_request: Request, { params }: PublicIdContext) {
  const { publicId } = await params;
  return withOptionalSession((headers) =>
    upstream.GET("/videos/{publicId}/playback", {
      params: { path: { publicId } },
      headers,
    })
  );
}
