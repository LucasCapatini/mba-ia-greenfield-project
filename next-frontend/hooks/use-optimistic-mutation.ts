"use client";

import { startTransition, useOptimistic, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";

import { loginHref } from "@/lib/auth/return-to";

export const GENERIC_ERROR_MESSAGE = "Something went wrong, try again";
export const TOO_MANY_MESSAGE = "Too many actions, try again in a moment";
export const UNAVAILABLE_MESSAGE = "This video is no longer available";

export type OptimisticMutationOptions<T> = {
  /** Toast do 404 (vídeo despublicado, comentário apagado — Error Catalog → UX mapping). */
  notFoundMessage?: string;
  /** Chamado com o corpo confirmado pelo servidor (ex.: atualizar o menu lateral — TD-08). */
  onConfirmed?: (confirmed: T) => void;
};

/** Falha de rede vira uma resposta 503: o otimista volta ao confirmado com o toast genérico. */
const networkFailure = () => new Response(null, { status: 503 });

/**
 * Estado confirmado + otimista, reconciliado pela resposta da mutação, sem `router.refresh()`
 * (social-interactions/TD-09). `initial` vem do RSC (TD-04); `run(next, request)` mostra `next`
 * na hora, envia `request` e adota o corpo da resposta 2xx como novo estado confirmado. Em
 * 4xx/5xx o otimista volta sozinho ao confirmado ao fim da transição; 401 leva ao login com
 * `returnTo` da página atual (TD-10).
 */
export function useOptimisticMutation<T>(
  initial: T,
  options: OptimisticMutationOptions<T> = {},
) {
  const router = useRouter();
  const pathname = usePathname();

  const messageFor = (res: Response): string => {
    if (res.status === 404) return options.notFoundMessage ?? UNAVAILABLE_MESSAGE;
    if (res.status === 429) return TOO_MANY_MESSAGE;
    return GENERIC_ERROR_MESSAGE;
  };

  // next-frontend/hooks/use-optimistic-mutation.ts — estado confirmado + otimista, reconciliado pela resposta (per TD-03)
  const [confirmed, setConfirmed] = useState(initial) // vem do RSC (per TD-04)
  const [shown, show] = useOptimistic(confirmed, (_current, next: T) => next)
  const run = (next: T, request: () => Promise<Response>) =>
    startTransition(async () => {
      show(next)
      const res = await request()
      if (res.status === 401) return router.push(loginHref(pathname))
      // `toast.error` devolve o id do toast; a transição precisa retornar void (React 19)
      if (!res.ok) return void toast.error(messageFor(res)) // sem setConfirmed: o otimista volta ao confirmado ao fim da transição
      const body = (await res.json()) as T
      startTransition(() => setConfirmed(body)) // update após await precisa de novo startTransition
      options.onConfirmed?.(body)
    })

  return {
    /** Estado exibido: o otimista durante a mutação, o confirmado fora dela. */
    shown,
    confirmed,
    run: (next: T, request: () => Promise<Response>) =>
      run(next, () => request().catch(networkFailure)),
  };
}
