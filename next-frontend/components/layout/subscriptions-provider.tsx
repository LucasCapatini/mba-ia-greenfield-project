"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { toast } from "sonner";

import type {
  SubscribedChannel,
  SubscribedChannelsPage,
} from "@/lib/api/contracts";

type SubscriptionsContextValue = {
  /** Canais seguidos em ordem alfabética do nome (TD-08, Revisions 2026-10-20). */
  channels: SubscribedChannel[];
  hasMore: boolean;
  loadingMore: boolean;
  /** Chamado pelo `SubscribeButton` só depois que o servidor confirma (TD-09). */
  onChange: (channel: SubscribedChannel, subscribed: boolean) => void;
  /** "Show more": próxima página de `GET /api/me/subscriptions?cursor=`. */
  loadMore: () => Promise<void>;
};

const SubscriptionsContext = createContext<SubscriptionsContextValue | null>(
  null,
);

const LOAD_MORE_ERROR = "Could not load more subscriptions, try again";

const byName = (a: SubscribedChannel, b: SubscribedChannel) =>
  a.name.localeCompare(b.name) || a.nickname.localeCompare(b.nickname);

/** Junta páginas sem repetir canais (um canal inserido pelo Subscribe pode vir de novo). */
function merge(
  current: SubscribedChannel[],
  incoming: SubscribedChannel[],
): SubscribedChannel[] {
  const known = new Set(current.map((channel) => channel.nickname));
  return [
    ...current,
    ...incoming.filter((channel) => !known.has(channel.nickname)),
  ];
}

/**
 * Lista de canais seguidos compartilhada entre o "Subscribe" e o menu lateral
 * (social-interactions/TD-08, TD-09). Semeada pelo RSC do layout com `GET /me/subscriptions?limit=7`;
 * `initial` nulo (leitura falhou) deixa a lista vazia e sem "Show more".
 */
export function SubscriptionsProvider({
  initial,
  children,
}: {
  initial: SubscribedChannelsPage | null;
  children: ReactNode;
}) {
  const [channels, setChannels] = useState<SubscribedChannel[]>(
    initial?.items ?? [],
  );
  const [cursor, setCursor] = useState<string | null>(
    initial?.next_cursor ?? null,
  );
  const [loadingMore, setLoadingMore] = useState(false);

  const onChange = (channel: SubscribedChannel, subscribed: boolean) => {
    setChannels((current) => {
      const rest = current.filter((item) => item.nickname !== channel.nickname);
      if (!subscribed) {
        return rest;
      }
      // Com mais páginas por carregar, um canal que cai depois do último carregado chega pelo
      // "Show more" na posição certa — inseri-lo agora quebraria a ordem.
      const last = rest[rest.length - 1];
      if (cursor !== null && last && byName(channel, last) > 0) {
        return rest;
      }
      return [...rest, channel].sort(byName);
    });
  };

  const loadMore = async () => {
    if (cursor === null || loadingMore) {
      return;
    }
    setLoadingMore(true);
    try {
      const res = await fetch(
        `/api/me/subscriptions?cursor=${encodeURIComponent(cursor)}`,
      );
      if (!res.ok) {
        toast.error(LOAD_MORE_ERROR);
        return;
      }
      const page = (await res.json()) as SubscribedChannelsPage;
      setChannels((current) => merge(current, page.items));
      setCursor(page.next_cursor);
    } catch {
      toast.error(LOAD_MORE_ERROR);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <SubscriptionsContext
      value={{
        channels,
        hasMore: cursor !== null,
        loadingMore,
        onChange,
        loadMore,
      }}
    >
      {children}
    </SubscriptionsContext>
  );
}

/**
 * Contexto dos canais seguidos; `null` fora do `SubscriptionsProvider` (watch page e visitante
 * anônimo — o Subscribe funciona sem o menu lateral).
 */
export function useSubscriptions(): SubscriptionsContextValue | null {
  return useContext(SubscriptionsContext);
}
