import { withSession, type NicknameContext } from "@/lib/api/bff";
import { upstream } from "@/lib/api/upstream";

// PUT|DELETE /api/channels/{nickname}/subscription → PUT|DELETE /channels/{nickname}/subscription:
// sem corpo; `{ subscribed, subscriber_count }` volta sem reshape para o Subscribe otimista e o
// menu lateral (social-interactions/TD-03, TD-08, TD-09). Próprio canal → 422 do upstream.
export async function PUT(_request: Request, { params }: NicknameContext) {
  const { nickname } = await params;
  return withSession((headers) =>
    upstream.PUT("/channels/{nickname}/subscription", {
      params: { path: { nickname } },
      headers,
    })
  );
}

export async function DELETE(_request: Request, { params }: NicknameContext) {
  const { nickname } = await params;
  return withSession((headers) =>
    upstream.DELETE("/channels/{nickname}/subscription", {
      params: { path: { nickname } },
      headers,
    })
  );
}
