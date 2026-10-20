import type { CreateVideoInput } from "@/lib/api/contracts";
import { cursorQuery, invalidBody, readJson, withOptionalSession, withSession } from "@/lib/api/bff";
import { upstream } from "@/lib/api/upstream";

// GET /api/videos → GET /videos — páginas seguintes da home e da busca no scroll infinito (a
// primeira vem do RSC); repassa `category`, `q`, `cursor` e `limit` sem reshape
// (home-search-production/TD-01, TD-02, TD-04). Sessão opcional + IP do visitante (watch-page/TD-03).
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const category = params.get("category");
  const q = params.get("q");
  return withOptionalSession((headers) =>
    upstream.GET("/videos", {
      params: {
        query: {
          ...cursorQuery(request),
          ...(category !== null && { category }),
          ...(q !== null && { q }),
        },
      },
      headers,
    })
  );
}

// POST /api/videos → POST /videos — cria o rascunho e a sessão multipart (201 pass-through).
export async function POST(request: Request) {
  const body = await readJson<CreateVideoInput>(request);
  if (body === null) {
    return invalidBody();
  }
  return withSession((headers) => upstream.POST("/videos", { body, headers }));
}
