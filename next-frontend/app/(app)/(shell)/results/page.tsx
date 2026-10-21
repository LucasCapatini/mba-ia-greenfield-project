import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"

import { upstream } from "@/lib/api/upstream"
import { publicRead } from "@/lib/api/public-read"
import { parseSearchQuery } from "@/lib/search/search-query"
import { InfiniteVideoGrid } from "@/components/videos/infinite-video-grid"

type ResultsProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata({ searchParams }: ResultsProps): Promise<Metadata> {
  const query = parseSearchQuery((await searchParams).q)
  return { title: query.kind === "redirect" ? "StreamTube" : `${query.q} — StreamTube` }
}

// /results?q= — resultados da busca (sem frame próprio: o grid da Home 143:948 sem os chips).
// RSC pública: `q` é normalizado antes de qualquer leitura (home-search-production/TD-02) — vazio
// volta à home, 1 caractere mostra a regra sem chamar a API —; a primeira página de
// `GET /videos?q=` vem via `publicRead` e as seguintes pelo scroll infinito (`GET /api/videos`,
// TD-04). Falha do upstream na primeira página → `error.tsx`.
export default async function Results({ searchParams }: ResultsProps) {
  const query = parseSearchQuery((await searchParams).q)
  if (query.kind === "redirect") {
    redirect("/")
  }

  const heading = (
    <h1 className="text-h2 text-foreground">Results for &ldquo;{query.q}&rdquo;</h1>
  )

  if (query.kind === "too-short") {
    return (
      <main className="flex w-full flex-col gap-6 px-4 py-6 sm:px-6">
        {heading}
        <p className="py-16 text-center text-body-lg text-muted-foreground">Enter at least 2 characters</p>
      </main>
    )
  }

  const { q } = query
  const result = await publicRead((headers) => upstream.GET("/videos", { params: { query: { q } }, headers }))
  if (!result.data) {
    throw new Error(`Could not search the videos (status ${result.response.status})`)
  }

  return (
    <main className="flex w-full flex-col gap-6 px-4 py-6 sm:px-6">
      {heading}
      {result.data.items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <p className="text-body-lg text-muted-foreground">No results for &ldquo;{q}&rdquo;</p>
          <p className="text-body-md text-muted-foreground">Try another term, or browse the latest videos.</p>
          <Link href="/" className="text-body-md text-link hover:underline">
            Go to the home page
          </Link>
        </div>
      ) : (
        <InfiniteVideoGrid
          key={q}
          aria-label="Search results"
          initial={result.data}
          endpoint="/api/videos"
          query={{ q }}
        />
      )}
    </main>
  )
}
