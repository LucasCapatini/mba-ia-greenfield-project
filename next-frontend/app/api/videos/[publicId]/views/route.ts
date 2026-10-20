import { withOptionalSession, type PublicIdContext } from "@/lib/api/bff";
import { upstream } from "@/lib/api/upstream";

// POST /api/videos/{publicId}/views → POST /videos/{publicId}/views (pass-through, sem corpo).
// Disparado pelo player após 10 s de reprodução (watch-page/TD-01); o IP e o User-Agent do
// visitante seguem para a deduplicação anônima da API (watch-page/TD-02, TD-03).
export async function POST(_request: Request, { params }: PublicIdContext) {
  const { publicId } = await params;
  return withOptionalSession((headers) =>
    upstream.POST("/videos/{publicId}/views", {
      params: { path: { publicId } },
      headers,
    })
  );
}
