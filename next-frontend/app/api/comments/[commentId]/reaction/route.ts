import type { SetReactionInput } from "@/lib/api/contracts";
import {
  invalidBody,
  readJson,
  withSession,
  type CommentIdContext,
} from "@/lib/api/bff";
import { upstream } from "@/lib/api/upstream";

// PUT|DELETE /api/comments/{commentId}/reaction → PUT|DELETE /comments/{commentId}/reaction: mesma
// semântica da reação ao vídeo, para raízes e respostas (social-interactions/TD-03, TD-09).
export async function PUT(request: Request, { params }: CommentIdContext) {
  const { commentId } = await params;
  const body = await readJson<SetReactionInput>(request);
  if (body === null) {
    return invalidBody();
  }
  return withSession((headers) =>
    upstream.PUT("/comments/{commentId}/reaction", {
      params: { path: { commentId } },
      body,
      headers,
    })
  );
}

export async function DELETE(_request: Request, { params }: CommentIdContext) {
  const { commentId } = await params;
  return withSession((headers) =>
    upstream.DELETE("/comments/{commentId}/reaction", {
      params: { path: { commentId } },
      headers,
    })
  );
}
