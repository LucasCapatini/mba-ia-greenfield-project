import { cursorQuery, withSession } from "@/lib/api/bff";
import { upstream } from "@/lib/api/upstream";

// GET /api/me/subscriptions → GET /me/subscriptions: "Show more" da lista de canais seguidos do
// menu lateral; os 7 primeiros vêm do RSC do layout (social-interactions/TD-08, Revisions).
export async function GET(request: Request) {
  return withSession((headers) =>
    upstream.GET("/me/subscriptions", {
      params: { query: cursorQuery(request) },
      headers,
    })
  );
}
