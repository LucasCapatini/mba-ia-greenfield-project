import { withSession, type PublicIdContext } from "@/lib/api/bff";
import { upstream } from "@/lib/api/upstream";

function invalidThumbnail(message: string): Response {
  return Response.json(
    { statusCode: 400, error: "VALIDATION_ERROR", message },
    { status: 400 }
  );
}

// PUT /api/videos/{publicId}/thumbnail → PUT /videos/{publicId}/thumbnail. Repassa só o campo
// `file` num FormData novo; o `fetch` monta o `multipart/form-data` com o boundary (nenhum
// Content-Type manual). Tipo, dimensões e o limite de 5 MiB (413) são validados no upstream.
export async function PUT(request: Request, { params }: PublicIdContext) {
  const { publicId } = await params;
  let received: FormData;
  try {
    received = await request.formData();
  } catch {
    return invalidThumbnail("Request body must be multipart/form-data");
  }
  const file = received.get("file");
  if (!(file instanceof File)) {
    return invalidThumbnail("file is required");
  }
  const form = new FormData();
  form.append("file", file, file.name);

  return withSession((headers) =>
    upstream.PUT("/videos/{publicId}/thumbnail", {
      params: { path: { publicId } },
      // O tipo gerado descreve o multipart como `{ file: string }` (binário); o serializer
      // padrão do openapi-fetch envia FormData como está.
      body: form as unknown as { file: string },
      headers,
    })
  );
}

// DELETE /api/videos/{publicId}/thumbnail → DELETE /videos/{publicId}/thumbnail — volta para a
// thumbnail automática (204).
export async function DELETE(_request: Request, { params }: PublicIdContext) {
  const { publicId } = await params;
  return withSession((headers) =>
    upstream.DELETE("/videos/{publicId}/thumbnail", {
      params: { path: { publicId } },
      headers,
    })
  );
}
