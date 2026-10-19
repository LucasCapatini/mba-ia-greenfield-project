import { http, HttpResponse } from "msw";

import type { paths } from "@/lib/api/types.gen";
import { env } from "@/lib/env";

import { CATEGORIES } from "../factories/videos";

type CategoriesOk =
  paths["/categories"]["get"]["responses"][200]["content"]["application/json"];

export const handlers = [
  // GET /categories — as 10 categorias da seed, em `sort_order`
  http.get(`${env.API_URL}/categories`, () =>
    HttpResponse.json<CategoriesOk>([...CATEGORIES]),
  ),
];
