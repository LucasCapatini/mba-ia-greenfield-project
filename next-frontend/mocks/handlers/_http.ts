import { HttpResponse } from "msw";

import type { paths } from "@/lib/api/types.gen";

// Envelope de erro do `DomainExceptionFilter` (`{ statusCode, error, message }`).
export type ApiError =
  paths["/videos/{publicId}"]["get"]["responses"][404]["content"]["application/json"];

export function apiError(
  statusCode: number,
  error: string,
  message: string,
): Response {
  return HttpResponse.json<ApiError>(
    { statusCode, error, message },
    { status: statusCode },
  );
}

/** 401 quando a requisição chega sem `Authorization: Bearer` (rotas do dono). */
export function requireBearer(request: Request): Response | null {
  const header = request.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ")
    ? null
    : apiError(401, "UNAUTHORIZED", "Unauthorized");
}

export const DEFAULT_PAGE_LIMIT = 20;

/** Cursor opaco dos fixtures: deslocamento na lista já filtrada e ordenada. */
export function encodeCursor(offset: number): string {
  return `offset-${offset}`;
}

export function decodeCursor(cursor: string | null): number | null {
  if (cursor === null) {
    return 0;
  }
  const match = /^offset-(\d+)$/.exec(cursor);
  return match ? Number(match[1]) : null;
}

export function parseLimit(raw: string | null): number | null {
  if (raw === null) {
    return DEFAULT_PAGE_LIMIT;
  }
  const limit = Number(raw);
  return Number.isInteger(limit) && limit >= 1 && limit <= 50 ? limit : null;
}

/** Fatia `[offset, offset + limit)` e o `next_cursor` da página seguinte (ou `null`). */
export function paginate<T>(
  items: readonly T[],
  offset: number,
  limit: number,
): { items: T[]; next_cursor: string | null } {
  const end = offset + limit;
  return {
    items: items.slice(offset, end),
    next_cursor: end < items.length ? encodeCursor(end) : null,
  };
}
