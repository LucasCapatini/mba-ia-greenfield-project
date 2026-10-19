import type { CompleteUploadInput, PresignPartsInput } from "@/lib/api/contracts";
import { invalidBody, readJson, withSession } from "@/lib/api/bff";
import { upstream } from "@/lib/api/upstream";

// Uma rota para `/api/videos/{publicId}/upload[/parts|/complete]`. Três arquivos
// (`upload/route.ts` + `upload/parts/` + `upload/complete/`) seriam o natural, mas o `next dev`
// 16.2.6 (Turbopack e webpack) não serve as filhas de um segmento estático com `route.ts` sob um
// segmento dinâmico — 404 em dev, normal em `next build`. O catch-all opcional mantém as mesmas
// URLs e o mesmo contrato do BFF.
type UploadContext = { params: Promise<{ publicId: string; action?: string[] }> };

function notFound(): Response {
  return Response.json(
    { statusCode: 404, error: "NOT_FOUND", message: "Not found" },
    { status: 404 }
  );
}

function methodNotAllowed(allow: string): Response {
  return new Response(null, { status: 405, headers: { Allow: allow } });
}

async function resolve(context: UploadContext) {
  const { publicId, action = [] } = await context.params;
  return { publicId, action: action.join("/") };
}

// GET /api/videos/{publicId}/upload → GET /videos/{publicId}/upload — estado da sessão multipart
// (retomada via `uploaded_parts`).
export async function GET(_request: Request, context: UploadContext) {
  const { publicId, action } = await resolve(context);
  if (action === "parts" || action === "complete") return methodNotAllowed("POST");
  if (action !== "") return notFound();
  return withSession((headers) =>
    upstream.GET("/videos/{publicId}/upload", {
      params: { path: { publicId } },
      headers,
    })
  );
}

// DELETE /api/videos/{publicId}/upload → DELETE /videos/{publicId}/upload — aborta o envio (204).
export async function DELETE(_request: Request, context: UploadContext) {
  const { publicId, action } = await resolve(context);
  if (action === "parts" || action === "complete") return methodNotAllowed("POST");
  if (action !== "") return notFound();
  return withSession((headers) =>
    upstream.DELETE("/videos/{publicId}/upload", {
      params: { path: { publicId } },
      headers,
    })
  );
}

// POST /api/videos/{publicId}/upload/parts → POST /videos/{publicId}/upload/parts. As URLs
// devolvidas apontam para o storage público: o navegador faz o PUT das partes direto nelas
// (exceção explícita ao Strict BFF, per phase-03-upload-processing/TD-03).
// POST /api/videos/{publicId}/upload/complete → POST /videos/{publicId}/upload/complete (202).
export async function POST(request: Request, context: UploadContext) {
  const { publicId, action } = await resolve(context);
  if (action === "") return methodNotAllowed("GET, DELETE");
  if (action === "parts") {
    const body = await readJson<PresignPartsInput>(request);
    if (body === null) return invalidBody();
    return withSession((headers) =>
      upstream.POST("/videos/{publicId}/upload/parts", {
        params: { path: { publicId } },
        body,
        headers,
      })
    );
  }
  if (action === "complete") {
    const body = await readJson<CompleteUploadInput>(request);
    if (body === null) return invalidBody();
    return withSession((headers) =>
      upstream.POST("/videos/{publicId}/upload/complete", {
        params: { path: { publicId } },
        body,
        headers,
      })
    );
  }
  return notFound();
}
