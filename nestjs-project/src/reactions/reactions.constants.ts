/** Valores do enum Postgres `reaction_value`, compartilhado pelas duas tabelas de reação (TD-01). */
export const REACTION_VALUES = ['like', 'dislike'] as const;

export type ReactionValue = (typeof REACTION_VALUES)[number];

/** Nome do tipo enum no Postgres — o mesmo nas duas entidades para o TypeORM não criar dois. */
export const REACTION_ENUM_NAME = 'reaction_value';

/** Throttle próprio das rotas de reação: 60 req/min por visitante (social-interactions/TD-03). */
export const REACTION_THROTTLE = {
  default: { limit: 60, ttl: 60_000 },
} as const;
