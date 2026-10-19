/**
 * Página keyset (video-channel-management/TD-06). As classes Swagger concretas de cada listagem
 * (`OwnerVideosPage`, `ChannelVideosPage`) implementam este formato — o plugin do Swagger não
 * documenta genéricos.
 */
export interface CursorPage<T> {
  items: T[];
  /** `null` na última página. */
  next_cursor: string | null;
}

/** Variante do painel do dono, com o total dos filtros aplicados (sem o cursor). */
export interface CountedCursorPage<T> extends CursorPage<T> {
  total: number;
}

export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 50;
