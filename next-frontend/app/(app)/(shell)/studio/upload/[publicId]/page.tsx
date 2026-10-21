import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import { upstream } from "@/lib/api/upstream"
import { clientHeaders } from "@/lib/api/client-headers"
import { getSession } from "@/lib/auth/session"
import { requestOrigin } from "@/lib/request-origin"
import { UploadVideoForm } from "@/components/upload/upload-video-form"

export const metadata: Metadata = {
  title: "Upload video",
}

type UploadProcessingPageProps = {
  params: Promise<{ publicId: string }>
}

// /studio/upload/{publicId} — envio + processamento + formulário de detalhes (Figma 156:2110).
// RSC: lê o vídeo (como dono) e as categorias via `upstream` (video-channel-management/TD-12).
export default async function UploadProcessingPage({ params }: UploadProcessingPageProps) {
  const { publicId } = await params
  const session = await getSession()
  const visitor = await clientHeaders()
  const headersInit = { ...visitor, Authorization: `Bearer ${session.accessToken}` }

  const [videoResult, categoriesResult, origin] = await Promise.all([
    upstream.GET("/videos/{publicId}", { params: { path: { publicId } }, headers: headersInit }),
    upstream.GET("/categories", { headers: visitor }),
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
    <main className="flex w-full flex-col gap-6 px-4 pt-8 pb-6 sm:px-6">
      <h1 className="text-h1 text-foreground">Upload video</h1>
      <UploadVideoForm
        video={videoResult.data}
        categories={categoriesResult.data ?? []}
        origin={origin}
      />
    </main>
  )
}
