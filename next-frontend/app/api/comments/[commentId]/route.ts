import type { UpdateCommentInput } from "@/lib/api/contracts";
import {
  invalidBody,
  readJson,
  withSession,
  type CommentIdContext,
} from "@/lib/api/bff";
import { upstream } from "@/lib/api/upstream";

// PATCH /api/comments/{commentId} → PATCH /comments/{commentId}: edição pelo autor; a resposta
// (com `edited_at`) substitui o item na lista sem recarregar (social-interactions/TD-07, TD-09).
export async function PATCH(request: Request, { params }: CommentIdContext) {
  const { commentId } = await params;
  const body = await readJson<UpdateCommentInput>(request);
  if (body === null) {
    return invalidBody();
  }
  return withSession((headers) =>
    upstream.PATCH("/comments/{commentId}", {
      params: { path: { commentId } },
      body,
      headers,
    })
  );
}

// DELETE /api/comments/{commentId} → DELETE /comments/{commentId} (204; não autor → 403).
export async function DELETE(_request: Request, { params }: CommentIdContext) {
  const { commentId } = await params;
  return withSession((headers) =>
    upstream.DELETE("/comments/{commentId}", {
      params: { path: { commentId } },
      headers,
    })
  );
}
