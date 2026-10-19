import type { ValueTransformer } from 'typeorm';

// O driver pg devolve `bigint` e `numeric` como string (podem exceder 2^53). Os valores deste
// domínio cabem em Number com folga (10 GiB ≈ 1e10; duração em segundos com 3 casas), então
// convertemos na borda para a entidade expor `number`.

export const bigintTransformer: ValueTransformer = {
  to: (value: number | null | undefined) =>
    value === null || value === undefined ? value : String(value),
  from: (value: string | number | null) =>
    value === null || value === undefined ? null : Number(value),
};

export const numericTransformer: ValueTransformer = {
  to: (value: number | null | undefined) =>
    value === null || value === undefined ? value : value,
  from: (value: string | number | null) =>
    value === null || value === undefined ? null : Number(value),
};
