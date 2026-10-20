import type { CreateCommentInput } from "@/lib/api/contracts";
import {
  cursorQuery,
  invalidBody,
  readJson,
  withOptionalSession,
  withSession,
  type CommentIdContext,
} from "@/lib/api/bff";
import { upstream } from "@/lib/api/upstream";

// GET /api/comments/{commentId}/replies → GET /comments/{commentId}/replies: respostas sob demanda,
// da mais antiga para a mais nova (social-interactions/TD-06, TD-09).
export async function GET(request: Request, { params }: CommentIdContext) {
  const { commentId } = await params;
  return withOptionalSession((headers) =>
    upstream.GET("/comments/{commentId}/replies", {
      params: { path: { commentId }, query: cursorQuery(request) },
      headers,
    })
  );
}

// POST /api/comments/{commentId}/replies → POST /comments/{commentId}/replies (201; responder a
// uma resposta grava na raiz — TD-05).
export async function POST(request: Request, { params }: CommentIdContext) {
  const { commentId } = await params;
  const body = await readJson<CreateCommentInput>(request);
  if (body === null) {
    return invalidBody();
  }
  return withSession((headers) =>
    upstream.POST("/comments/{commentId}/replies", {
      params: { path: { commentId } },
      body,
      headers,
    })
  );
}
