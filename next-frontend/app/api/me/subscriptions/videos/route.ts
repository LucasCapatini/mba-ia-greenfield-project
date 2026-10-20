import { cursorQuery, withSession } from "@/lib/api/bff";
import { upstream } from "@/lib/api/upstream";

// GET /api/me/subscriptions/videos → GET /me/subscriptions/videos — páginas seguintes do feed das
// inscrições no scroll infinito (home-search-production/TD-04). Exige sessão: sem ela, 401 sem
// chamar o upstream (phase-02-auth-frontend/TD-01, TD-03).
export async function GET(request: Request) {
  return withSession((headers) =>
    upstream.GET("/me/subscriptions/videos", {
      params: { query: cursorQuery(request) },
      headers,
    })
  );
}
