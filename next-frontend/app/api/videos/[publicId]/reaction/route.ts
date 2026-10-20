import type { SetReactionInput } from "@/lib/api/contracts";
import {
  invalidBody,
  readJson,
  withSession,
  type PublicIdContext,
} from "@/lib/api/bff";
import { upstream } from "@/lib/api/upstream";

// PUT|DELETE /api/videos/{publicId}/reaction → PUT|DELETE /videos/{publicId}/reaction: set-state
// idempotente; o estado resultante (`ReactionState`) volta sem reshape para o botão otimista
// reconciliar (social-interactions/TD-03, TD-09).
export async function PUT(request: Request, { params }: PublicIdContext) {
  const { publicId } = await params;
  const body = await readJson<SetReactionInput>(request);
  if (body === null) {
    return invalidBody();
  }
  return withSession((headers) =>
    upstream.PUT("/videos/{publicId}/reaction", {
      params: { path: { publicId } },
      body,
      headers,
    })
  );
}

export async function DELETE(_request: Request, { params }: PublicIdContext) {
  const { publicId } = await params;
  return withSession((headers) =>
    upstream.DELETE("/videos/{publicId}/reaction", {
      params: { path: { publicId } },
      headers,
    })
  );
}
