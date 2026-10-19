"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import type { Video } from "@/lib/api/contracts";

type VideoResponse = Video;

const POLL_INTERVAL_MS = 3_000;
const TERMINAL = new Set(["ready", "failed"]);

/**
 * Acompanha vídeos em `uploading|processing` (video-channel-management/TD-12): a cada
 * `POLL_INTERVAL_MS` lê o estado pelo BFF e, quando um id chega a `ready|failed`, recarrega o RSC
 * com `router.refresh()` — a página volta a ler tudo no servidor. Passe só os ids ainda em voo;
 * lista vazia não agenda nada.
 */
export function useProcessingPoll(publicIds: readonly string[]): void {
  const router = useRouter();
  // Dependência estável: um array novo com os mesmos ids não reinicia o timer.
  const idsKey = publicIds.join(",");

  useEffect(() => {
    // polls only the ids still in flight; stops by itself when every id is terminal
    const inFlight = new Set(idsKey === "" ? [] : idsKey.split(","));
    if (inFlight.size === 0) {
      return;
    }
    let disposed = false;

    async function poll(publicId: string): Promise<void> {
      const res = await fetch(`/api/videos/${publicId}`);           // BFF route, never upstream
      if (!res.ok || disposed) {
        return; // falha transitória ou 4xx: o próximo ciclo tenta de novo
      }
      const { processing_status } = (await res.json()) as VideoResponse;
      if (disposed) {
        return;
      }
      if (TERMINAL.has(processing_status)) inFlight.delete(publicId);
      if (TERMINAL.has(processing_status)) router.refresh();        // RSC re-renders with fresh data
    }

    const timer = setInterval(() => {
      void Promise.allSettled([...inFlight].map(poll)).then(() => {
        if (inFlight.size === 0) {
          clearInterval(timer);
        }
      });
    }, POLL_INTERVAL_MS);

    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, [idsKey, router]);
}
