import { withSession, type PublicIdContext } from "@/lib/api/bff";
import { upstream } from "@/lib/api/upstream";

// POST /api/videos/{publicId}/publish → POST /videos/{publicId}/publish (pass-through).
export async function POST(_request: Request, { params }: PublicIdContext) {
  const { publicId } = await params;
  return withSession((headers) =>
    upstream.POST("/videos/{publicId}/publish", {
      params: { path: { publicId } },
      headers,
    })
  );
}
