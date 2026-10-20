import type { EntityManager, EntityTarget, ObjectLiteral } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import type { ReactionValue } from './reactions.constants';

/** Linha de reação: PK composta (usuário + alvo) e o valor. */
type ReactionRow = ObjectLiteral & { value: ReactionValue };

/**
 * Grava a reação de um usuário a um alvo dentro da transação `manager` e devolve o valor
 * anterior (`null` = não havia), para o chamador somar o delta nos contadores
 * (social-interactions/TD-02). Protocolo contra a corrida do mesmo usuário (duplo clique, duas
 * abas): a linha existente é travada com `SELECT … FOR UPDATE`; se não existe, tenta
 * `INSERT … ON CONFLICT DO NOTHING` e, se perdeu a corrida para outra transação, volta a travar
 * a linha que a outra criou. `next = null` remove com `DELETE … RETURNING`.
 */
export async function writeReaction(
  manager: EntityManager,
  target: EntityTarget<ReactionRow>,
  key: Record<string, string>,
  next: ReactionValue | null,
): Promise<ReactionValue | null> {
  if (next === null) {
    const deleted = await manager
      .createQueryBuilder()
      .delete()
      .from(target)
      .where(key)
      .returning(['value'])
      .execute();
    const rows = deleted.raw as { value: ReactionValue }[];
    return rows[0]?.value ?? null;
  }

  // Duas voltas bastam: na segunda, a linha criada pela transação concorrente já está commitada.
  for (let attempt = 0; attempt < 2; attempt++) {
    const existing = await manager.findOne(target, {
      where: key,
      lock: { mode: 'pessimistic_write' },
    });
    if (existing) {
      if (existing.value !== next) {
        await manager.update(target, key, {
          value: next,
        } as QueryDeepPartialEntity<ReactionRow>);
      }
      return existing.value;
    }

    const inserted = await manager
      .createQueryBuilder()
      .insert()
      .into(target)
      .values({ ...key, value: next } as QueryDeepPartialEntity<ReactionRow>)
      .orIgnore()
      .returning(['value'])
      .execute();
    if ((inserted.raw as unknown[]).length > 0) return null;
  }

  throw new Error('Reaction row vanished between the conflict and the lock');
}
