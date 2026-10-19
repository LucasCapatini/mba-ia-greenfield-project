// Política de nickname e contrato do canal (video-channel-management/TD-08; allowlist herdada de
// phase-02-auth/TD-10). O nickname vai na URL pública (`/channel/{nickname}`), é mutável e o
// antigo é liberado na hora, sem redirecionamento.

/** Mesma allowlist do cadastro: minúsculas, dígitos e `_`, 3..50 caracteres, sem `@`. */
export const NICKNAME_PATTERN = /^[a-z0-9_]{3,50}$/;

/** Segmentos de rota e nomes de sistema que um canal não pode usar. */
export const RESERVED_NICKNAMES = [
  'me',
  'admin',
  'channel',
  'channels',
  'studio',
  'api',
  'watch',
  'login',
  'signup',
] as const;

export const CHANNEL_NAME_MAX_LENGTH = 50;
export const CHANNEL_DESCRIPTION_MAX_LENGTH = 1000;

export const CHANNEL_ERROR_CODES = {
  NICKNAME_TAKEN: 'NICKNAME_TAKEN',
  NOT_FOUND: 'CHANNEL_NOT_FOUND',
} as const;
