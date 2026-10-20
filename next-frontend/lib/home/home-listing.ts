import type { PublicVideosPage } from "@/lib/api/contracts";

/** Result of one `GET /videos` read — the `{ data, error, response }` triple of `openapi-fetch`. */
type ListingRead = {
  data?: PublicVideosPage;
  error?: unknown;
  response: Response;
};

/** Reads the first page of `GET /videos`, filtered by `category` when given. */
type ReadFirstPage = (category: string | undefined) => Promise<ListingRead>;

type HomeListing = {
  page: PublicVideosPage;
  /** Slug of the filter actually applied (`null` = "All"). */
  activeCategory: string | null;
  /** `?category=` named a category that does not exist — the page shows "Category not found". */
  categoryNotFound: boolean;
};

function errorCode(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "error" in error) {
    const code = (error as { error: unknown }).error;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

function failed(read: ListingRead): never {
  throw new Error(`Could not load the home videos (status ${read.response.status})`);
}

/**
 * First page of the home (home-search-production/TD-01, Revisions 2026-10-20): `?category=` is
 * passed through; an unknown slug (`404 CATEGORY_NOT_FOUND`) falls back to the general listing with
 * "All" active and a notice — no `notFound()` nor redirect. Any other failure throws, so the
 * segment's `error.tsx` offers "Try again". A stale cursor of the following pages is the hook's
 * concern (it starts over).
 */
async function loadHomeListing(
  category: string | undefined,
  readFirstPage: ReadFirstPage
): Promise<HomeListing> {
  const read = await readFirstPage(category);
  if (read.data) {
    return { page: read.data, activeCategory: category ?? null, categoryNotFound: false };
  }
  if (category && read.response.status === 404 && errorCode(read.error) === "CATEGORY_NOT_FOUND") {
    const general = await readFirstPage(undefined);
    if (!general.data) failed(general);
    return { page: general.data, activeCategory: null, categoryNotFound: true };
  }
  failed(read);
}

export { loadHomeListing };
export type { HomeListing, ListingRead, ReadFirstPage };
