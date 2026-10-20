import type { ChannelVideosQuery } from "@/lib/api/contracts";
import { cursorQuery, withOptionalSession, type NicknameContext } from "@/lib/api/bff";
import { upstream } from "@/lib/api/upstream";

// GET /api/channels/{nickname}/videos → GET /channels/{nickname}/videos — páginas seguintes da
// página pública do canal no scroll infinito, mantendo a ordenação `sort`
// (home-search-production/TD-04). Sessão opcional + IP do visitante (watch-page/TD-03).
export async function GET(request: Request, { params }: NicknameContext) {
  const { nickname } = await params;
  const sort = new URL(request.url).searchParams.get("sort");
  return withOptionalSession((headers) =>
    upstream.GET("/channels/{nickname}/videos", {
      params: {
        path: { nickname },
        query: {
          ...cursorQuery(request),
          ...(sort !== null && { sort: sort as NonNullable<ChannelVideosQuery["sort"]> }),
        },
      },
      headers,
    })
  );
}
