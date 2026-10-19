import type { Metadata } from "next"
import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"

import { upstream } from "@/lib/api/upstream"
import { getSession } from "@/lib/auth/session"
import { UploadVideoForm } from "@/components/upload/upload-video-form"

export const metadata: Metadata = {
  title: "Upload video",
}

type UploadProcessingPageProps = {
  params: Promise<{ publicId: string }>
}

/** Origem pública do app, para o link `/watch/{publicId}` (OQ-5). */
async function requestOrigin(): Promise<string> {
  const list = await headers()
  const host = list.get("x-forwarded-host") ?? list.get("host") ?? "localhost:3001"
  const protocol = list.get("x-forwarded-proto") ?? "http"
  return `${protocol}://${host}`
}

// /studio/upload/{publicId} — envio + processamento + formulário de detalhes (Figma 156:2110).
// RSC: lê o vídeo (como dono) e as categorias via `upstream` (video-channel-management/TD-12).
export default async function UploadProcessingPage({ params }: UploadProcessingPageProps) {
  const { publicId } = await params
  const session = await getSession()
  const headersInit = { Authorization: `Bearer ${session.accessToken}` }

  const [videoResult, categoriesResult, origin] = await Promise.all([
    upstream.GET("/videos/{publicId}", { params: { path: { publicId } }, headers: headersInit }),
    upstream.GET("/categories"),
    requestOrigin(),
  ])
  // Leitura como dono (o upstream decide a posse): 404 e 403 viram a página de não encontrado,
  // sem revelar que o vídeo existe em outro canal; 401 (sessão expirada) volta ao login.
  if (videoResult.response.status === 401) {
    redirect(`/login?returnTo=/studio/upload/${encodeURIComponent(publicId)}`)
  }
  if (!videoResult.data) {
    notFound()
  }

  return (
    <main className="flex w-full flex-col gap-6 px-6 pt-8 pb-6">
      <h1 className="text-h1 text-foreground">Upload video</h1>
      <UploadVideoForm
        video={videoResult.data}
        categories={categoriesResult.data ?? []}
        origin={origin}
      />
    </main>
  )
}
