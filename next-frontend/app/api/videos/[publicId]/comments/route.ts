import type { CommentSort, CreateCommentInput } from "@/lib/api/contracts";
import {
  cursorQuery,
  invalidBody,
  readJson,
  withOptionalSession,
  withSession,
  type PublicIdContext,
} from "@/lib/api/bff";
import { upstream } from "@/lib/api/upstream";

// GET /api/videos/{publicId}/comments → GET /videos/{publicId}/comments: páginas seguintes e troca
// de ordenação (a primeira página vem do RSC); sessão opcional preenche `viewer_*`
// (social-interactions/TD-06, TD-09).
export async function GET(request: Request, { params }: PublicIdContext) {
  const { publicId } = await params;
  const sort = new URL(request.url).searchParams.get("sort");
  return withOptionalSession((headers) =>
    upstream.GET("/videos/{publicId}/comments", {
      params: {
        path: { publicId },
        query: {
          ...cursorQuery(request),
          ...(sort !== null && { sort: sort as CommentSort }),
        },
      },
      headers,
    })
  );
}

// POST /api/videos/{publicId}/comments → POST /videos/{publicId}/comments (201 pass-through).
export async function POST(request: Request, { params }: PublicIdContext) {
  const { publicId } = await params;
  const body = await readJson<CreateCommentInput>(request);
  if (body === null) {
    return invalidBody();
  }
  return withSession((headers) =>
    upstream.POST("/videos/{publicId}/comments", {
      params: { path: { publicId } },
      body,
      headers,
    })
  );
}
