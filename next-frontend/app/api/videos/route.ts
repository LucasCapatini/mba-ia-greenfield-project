import type { CreateVideoInput } from "@/lib/api/contracts";
import { invalidBody, readJson, withSession } from "@/lib/api/bff";
import { upstream } from "@/lib/api/upstream";

// POST /api/videos → POST /videos — cria o rascunho e a sessão multipart (201 pass-through).
export async function POST(request: Request) {
  const body = await readJson<CreateVideoInput>(request);
  if (body === null) {
    return invalidBody();
  }
  return withSession((headers) => upstream.POST("/videos", { body, headers }));
}
