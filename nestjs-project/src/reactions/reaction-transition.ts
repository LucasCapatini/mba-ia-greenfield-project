import type { ReactionValue } from './reactions.constants';

export interface ReactionDelta {
  like: number;
  dislike: number;
}

/**
 * Deltas dos contadores para a transição de uma reação (social-interactions/TD-02): `null` = sem
 * reação. Mesmo valor → nenhum delta (a escrita set-state é idempotente, TD-03).
 */
export function reactionDelta(
  previous: ReactionValue | null,
  next: ReactionValue | null,
): ReactionDelta {
  const delta: ReactionDelta = { like: 0, dislike: 0 };
  if (previous === next) return delta;
  if (previous) delta[previous] -= 1;
  if (next) delta[next] += 1;
  return delta;
}
