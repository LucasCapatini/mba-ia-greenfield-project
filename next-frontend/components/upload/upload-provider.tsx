"use client"

import * as React from "react"

import type { VideoCreated } from "@/lib/api/contracts"
import {
  resumeUpload,
  startUpload,
  UploadCancelledError,
  UploadError,
  type UploadHandle,
  type UploadProgress,
} from "@/lib/upload/multipart-uploader"

export type UploadEntryStatus = "uploading" | "completed" | "failed" | "cancelled"

export type UploadEntry = {
  file: File
  /** Progresso do envio multipart, 0–100. */
  progress: number
  status: UploadEntryStatus
  error: string | null
  /** Envelope/uploader code of the failure (`UPLOAD_NOT_ACTIVE`, `STORAGE_PART_FAILED`, …). */
  errorCode: string | null
}

export type UploadContextValue = {
  /** Envios conhecidos nesta sessão do estúdio, por `publicId`. */
  uploads: ReadonlyMap<string, UploadEntry>
  /** Começa a enviar `file` para a sessão aberta por `POST /api/videos`. */
  start: (file: File, created: VideoCreated) => void
  /** Retoma uma sessão ainda ativa com o mesmo arquivo (ex.: depois de recarregar a página). */
  resume: (publicId: string, file: File) => void
  /** Interrompe o envio e aborta a sessão multipart. */
  cancel: (publicId: string) => Promise<void>
}

const UploadContext = React.createContext<UploadContextValue | null>(null)

function percent({ uploadedBytes, totalBytes }: UploadProgress): number {
  return totalBytes === 0 ? 100 : Math.floor((uploadedBytes / totalBytes) * 100)
}

/**
 * Estado dos uploads multipart do estúdio (video-channel-management/TD-11): montado uma vez em
 * `app/(app)/studio/layout.tsx`, sobrevive à navegação entre as telas de `/studio/**` — o envio
 * continua e o progresso segue disponível ao voltar. Avisa no `beforeunload` só enquanto há envio
 * em andamento (recarregar a página interrompe o envio; a tela oferece retomar).
 */
function UploadProvider({ children }: { children: React.ReactNode }) {
  const [uploads, setUploads] = React.useState<ReadonlyMap<string, UploadEntry>>(
    () => new Map()
  )
  const handles = React.useRef(new Map<string, UploadHandle>())

  const update = React.useCallback(
    (publicId: string, patch: Partial<UploadEntry>) => {
      setUploads((current) => {
        const entry = current.get(publicId)
        if (!entry) {
          return current
        }
        const next = new Map(current)
        next.set(publicId, { ...entry, ...patch })
        return next
      })
    },
    []
  )

  const track = React.useCallback(
    (
      publicId: string,
      file: File,
      launch: (onProgress: (progress: UploadProgress) => void) => UploadHandle
    ) => {
      setUploads((current) =>
        new Map(current).set(publicId, {
          file,
          progress: 0,
          status: "uploading",
          error: null,
          errorCode: null,
        })
      )
      const handle = launch((progress) => update(publicId, { progress: percent(progress) }))
      handles.current.set(publicId, handle)
      handle.done.then(
        () => update(publicId, { status: "completed", progress: 100 }),
        (error: unknown) => {
          if (handles.current.get(publicId) !== handle) {
            return // substituído por um novo envio do mesmo vídeo
          }
          update(
            publicId,
            error instanceof UploadCancelledError
              ? { status: "cancelled" }
              : {
                  status: "failed",
                  error: error instanceof Error ? error.message : "Upload failed",
                  errorCode: error instanceof UploadError ? error.code : null,
                }
          )
        }
      )
    },
    [update]
  )

  const start = React.useCallback(
    (file: File, created: VideoCreated) =>
      track(created.public_id, file, (onProgress) =>
        startUpload({ file, created, onProgress })
      ),
    [track]
  )

  const resume = React.useCallback(
    (publicId: string, file: File) =>
      track(publicId, file, (onProgress) => resumeUpload({ file, publicId, onProgress })),
    [track]
  )

  const cancel = React.useCallback(
    async (publicId: string) => {
      const handle = handles.current.get(publicId)
      if (!handle) {
        return
      }
      update(publicId, { status: "cancelled" })
      await handle.cancel()
    },
    [update]
  )

  const uploading = React.useMemo(
    () => [...uploads.values()].some((entry) => entry.status === "uploading"),
    [uploads]
  )

  React.useEffect(() => {
    if (!uploading) {
      return
    }
    function warnWhileUploading(event: BeforeUnloadEvent) {
      event.preventDefault()
    }
    window.addEventListener("beforeunload", warnWhileUploading);  // only while an upload is in flight
    return () => window.removeEventListener("beforeunload", warnWhileUploading)
  }, [uploading])

  const value = React.useMemo<UploadContextValue>(
    () => ({ uploads, start, resume, cancel }),
    [uploads, start, resume, cancel]
  )

  return <UploadContext.Provider value={value}>{children}</UploadContext.Provider>
}

/** Contexto inteiro (todos os envios + ações) — ex.: o dropzone, que ainda não tem `publicId`. */
function useUploads(): UploadContextValue {
  const context = React.useContext(UploadContext)
  if (!context) {
    throw new Error("useUpload must be used inside <UploadProvider> (app/(app)/studio/layout.tsx)")
  }
  return context
}

/** Estado do envio de `publicId` (ou `undefined` se não há envio nesta sessão) + ações. */
function useUpload(publicId: string) {
  const { uploads, start, resume, cancel } = useUploads()
  return {
    upload: uploads.get(publicId),
    start,
    resume: React.useCallback((file: File) => resume(publicId, file), [resume, publicId]),
    cancel: React.useCallback(() => cancel(publicId), [cancel, publicId]),
  }
}

export { UploadProvider, UploadContext, useUpload, useUploads }
