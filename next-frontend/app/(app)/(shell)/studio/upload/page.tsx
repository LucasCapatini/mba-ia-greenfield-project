import type { Metadata } from "next"

import { UploadDropzone } from "@/components/upload/upload-dropzone"

export const metadata: Metadata = {
  title: "Upload video",
}

// /studio/upload — escolha do arquivo. A sessão é garantida pelo `proxy.ts` e pelo layout do
// estúdio; o dropzone abre a sessão multipart e leva à tela de processamento.
export default function StudioUploadPage() {
  return (
    <main className="flex w-full flex-col gap-6 px-4 pt-8 pb-6 sm:px-6">
      <h1 className="text-h1 text-foreground">Upload video</h1>
      <UploadDropzone />
    </main>
  )
}
