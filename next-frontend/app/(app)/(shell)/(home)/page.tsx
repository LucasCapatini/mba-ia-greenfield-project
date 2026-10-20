import type { Metadata } from "next"
import Link from "next/link"

import { upstream } from "@/lib/api/upstream"
import { publicRead } from "@/lib/api/public-read"
import { loadHomeListing } from "@/lib/home/home-listing"
import { CategoryChips } from "@/components/home/category-chips"
import { InfiniteVideoGrid } from "@/components/videos/infinite-video-grid"

export const metadata: Metadata = {
  title: "StreamTube",
}

type HomeProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function first(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value
  return raw === undefined || raw === "" ? undefined : raw
}

// / — página inicial (Figma Home / Catalog Show 143:948). RSC pública: as categorias e a primeira
// página de `GET /videos?category=` em paralelo (home-search-production/TD-01, `publicRead`); as
// páginas seguintes chegam pelo scroll infinito via `GET /api/videos` (TD-04). Slug desconhecido
// cai para a lista geral com "All" ativo e um aviso; falha do upstream → `error.tsx`.
export default async function Home({ searchParams }: HomeProps) {
  const category = first((await searchParams).category)
  const [categories, listing] = await Promise.all([
    // With the visitor's headers: without them every home render would share the BFF's rate budget.
    publicRead((headers) => upstream.GET("/categories", { headers })),
    loadHomeListing(category, (slug) =>
      publicRead((headers) =>
        upstream.GET("/videos", { params: { query: slug ? { category: slug } : {} }, headers })
      )
    ),
  ])
  const { page, activeCategory, categoryNotFound } = listing

  return (
    <main className="flex w-full flex-col">
      <div className="sticky top-0 z-10 border-b border-border bg-background px-4 py-3 sm:px-6">
        <CategoryChips categories={categories.data ?? []} activeSlug={activeCategory} />
      </div>
      <div className="flex flex-col gap-6 px-4 py-6 sm:px-6">
        {categoryNotFound ? (
          <p role="status" className="text-body-md text-muted-foreground">
            Category not found — showing all videos.
          </p>
        ) : null}
        {page.items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <p className="text-body-lg text-muted-foreground">
              {activeCategory ? "No videos in this category yet." : "No videos yet."}
            </p>
            {activeCategory ? (
              <Link href="/" className="text-body-md text-link hover:underline">
                See all videos
              </Link>
            ) : null}
          </div>
        ) : (
          <InfiniteVideoGrid
            key={activeCategory ?? "all"}
            aria-label="Videos"
            initial={page}
            endpoint="/api/videos"
            query={{ category: activeCategory }}
          />
        )}
      </div>
    </main>
  )
}
