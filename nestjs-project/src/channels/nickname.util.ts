import { randomBytes } from 'crypto';
import { NICKNAME_PATTERN, RESERVED_NICKNAMES } from './channels.constants';

// Max nickname base length reserves 4 chars for the '_xxx' suffix (total column limit: 50)
const MAX_BASE_LENGTH = 46;

function randomHex(length: number): string {
  return randomBytes(Math.ceil(length / 2))
    .toString('hex')
    .slice(0, length);
}

export function sanitizeNickname(emailPrefix: string): string {
  const sanitized = emailPrefix
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, MAX_BASE_LENGTH);
  if (!sanitized) {
    return 'user_' + randomHex(8);
  }
  return sanitized;
}

/**
 * Um nickname derivado do e-mail só é usado como está quando cumpre o mesmo contrato do
 * `PATCH /channels/me` — `NICKNAME_PATTERN` (3..50) e fora de `RESERVED_NICKNAMES`; senão o
 * cadastro parte direto para o sufixo aleatório de colisão (saneamento-fase-04/TD-02).
 */
export function isUsableNickname(nickname: string): boolean {
  return (
    NICKNAME_PATTERN.test(nickname) &&
    !(RESERVED_NICKNAMES as readonly string[]).includes(nickname)
  );
}

export function appendRandomSuffix(nickname: string): string {
  const base = nickname.slice(0, MAX_BASE_LENGTH);
  return base + '_' + randomHex(3);
}
