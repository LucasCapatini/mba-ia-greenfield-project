"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { loginHref } from "@/lib/auth/return-to";

/** Página keyset entregue pela RSC (primeira) e pelo BFF (as seguintes). */
type CursorPage<T> = { items: T[]; next_cursor: string | null };

type CursorListStatus = "idle" | "loading" | "error";

type UseCursorListOptions<T> = {
  /** Primeira página, lida pela RSC. */
  initial: CursorPage<T>;
  /** Route Handler same-origin que serve as páginas seguintes (`/api/...`). */
  endpoint: string;
  /** Query fixa da lista (filtro, termo, ordem); o `cursor` é acrescentado por página. */
  query?: Record<string, string | null | undefined>;
};

type StoredList<T> = { items: T[]; nextCursor: string | null; scrollY: number };

/** Listas salvas acima deste tamanho não são guardadas — a volta recomeça da primeira página. */
const MAX_STORED_ITEMS = 200;

function readStored<T>(storageKey: string): StoredList<T> | null {
  try {
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return null;
    const stored = JSON.parse(raw) as StoredList<T>;
    return Array.isArray(stored.items) && stored.items.length <= MAX_STORED_ITEMS ? stored : null;
  } catch {
    return null;
  }
}

/**
 * Scroll infinito sobre uma listagem keyset (home-search-production/TD-04): a RSC entrega a
 * primeira página e `loadMore` busca as seguintes no BFF para o estado local — sem
 * `router.refresh()` e sem biblioteca de cache no cliente. Itens, `next_cursor` e a posição de
 * scroll ficam no `sessionStorage` por URL, então voltar da página de vídeo restaura a lista onde
 * estava. Monte o consumidor com `key` = filtros da lista para que um filtro novo recomece do zero.
 */
function useCursorList<T extends { public_id: string }>({
  initial,
  endpoint,
  query = {},
}: UseCursorListOptions<T>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const storageKey = `cursor-list:${pathname}?${searchParams}`; // uma entrada por URL

  const [items, setItems] = React.useState<T[]>(initial.items);
  const [nextCursor, setNextCursor] = React.useState<string | null>(initial.next_cursor);
  const [status, setStatus] = React.useState<CursorListStatus>("idle");
  const inFlight = React.useRef(false);
  const latest = React.useRef({ items, nextCursor });
  const lastScrollY = React.useRef(0);
  const pendingScroll = React.useRef<number | null>(null);

  const baseQuery = new URLSearchParams(
    Object.entries(query).filter((entry): entry is [string, string] => Boolean(entry[1]))
  ).toString();

  React.useEffect(() => {
    latest.current = { items, nextCursor };
  }, [items, nextCursor]);

  // Restaura a lista salva para esta URL (navegação de volta). Roda após a hidratação, então o
  // HTML do servidor e o primeiro render do cliente concordam na página da RSC.
  React.useEffect(() => {
    const stored = readStored<T>(storageKey);
    if (!stored) return;
    pendingScroll.current = stored.scrollY;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage só existe após a hidratação
    setItems(stored.items);
    setNextCursor(stored.nextCursor);
  }, [storageKey]);

  // Reposiciona o scroll depois que os itens restaurados foram renderizados.
  React.useEffect(() => {
    if (pendingScroll.current === null) return;
    window.scrollTo(0, pendingScroll.current);
    pendingScroll.current = null;
  }, [items]);

  // Acompanha a posição de scroll e salva a lista ao desmontar (saída para outra página).
  React.useEffect(() => {
    const onScroll = () => {
      lastScrollY.current = window.scrollY;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      const { items, nextCursor } = latest.current;
      const scrollY = lastScrollY.current;
      try {
        if (items.length > MAX_STORED_ITEMS) {
          sessionStorage.removeItem(storageKey);
          return;
        }
        sessionStorage.setItem(storageKey, JSON.stringify({ items, nextCursor, scrollY }));
      } catch {
        // Storage cheio ou indisponível: a volta apenas recomeça da primeira página.
      }
    };
  }, [storageKey]);

  const loadMore = React.useCallback(async () => {
    if (inFlight.current || nextCursor === null) return;
    inFlight.current = true;
    setStatus("loading");
    try {
      const params = new URLSearchParams(baseQuery);
      params.set("cursor", nextCursor);
      const res = await fetch(`${endpoint}?${params}`);
      if (res.status === 401) {
        const search = searchParams.toString();
        router.push(loginHref(search ? `${pathname}?${search}` : pathname));
        return;
      }
      if (res.status === 400) {
        // Cursor adulterado ou obsoleto: recomeça da página da RSC.
        setItems(initial.items);
        setNextCursor(initial.next_cursor);
        setStatus("idle");
        return;
      }
      if (!res.ok) {
        setStatus("error");
        return;
      }
      const page = (await res.json()) as CursorPage<T>;
      setItems((current) => {
        const known = new Set(current.map((item) => item.public_id));
        return [...current, ...page.items.filter((item) => !known.has(item.public_id))];
      });
      setNextCursor(page.next_cursor);
      setStatus("idle");
    } catch {
      setStatus("error");
    } finally {
      inFlight.current = false;
    }
  }, [baseQuery, endpoint, initial, nextCursor, pathname, router, searchParams]);

  return { items, nextCursor, loadMore, status };
}

export { useCursorList, MAX_STORED_ITEMS };
export type { CursorPage, CursorListStatus, UseCursorListOptions };
