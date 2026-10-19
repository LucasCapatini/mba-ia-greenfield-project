import { DomainException } from '../exceptions/domain.exception';

/**
 * Posição de uma página keyset (video-channel-management/TD-06): o valor da coluna de ordenação
 * da última linha entregue (`value`, sempre como TEXTO lido do banco — um timestamp do Postgres
 * tem microssegundos e o `Date` do JS só milissegundos, o que pularia linhas no mesmo ms), o
 * desempate `id` e a ordenação (`sort`) para a qual o cursor foi emitido.
 */
export interface CursorPosition {
  sort: string;
  value: string;
  id: string;
}

/** Cursor corrompido, adulterado ou emitido para outra ordenação — mesmo código do ValidationPipe. */
export class InvalidCursorException extends DomainException {
  constructor() {
    super('VALIDATION_ERROR', 400, 'cursor is invalid');
  }
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Cursor opaco: JSON compacto em base64url. */
export function encodeCursor(position: CursorPosition): string {
  return Buffer.from(
    JSON.stringify([position.sort, position.value, position.id]),
  ).toString('base64url');
}

/**
 * Decodifica e valida o cursor. `expectedSort` amarra o cursor à ordenação pedida: reaproveitar
 * um cursor de `latest` numa consulta `popular` compararia valores de colunas diferentes.
 */
export function decodeCursor(
  raw: string,
  expectedSort: string,
): CursorPosition {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
  } catch {
    throw new InvalidCursorException();
  }
  if (
    !Array.isArray(parsed) ||
    parsed.length !== 3 ||
    !parsed.every((part) => typeof part === 'string')
  ) {
    throw new InvalidCursorException();
  }
  const [sort, value, id] = parsed as [string, string, string];
  if (sort !== expectedSort || value.length === 0 || !UUID_PATTERN.test(id)) {
    throw new InvalidCursorException();
  }
  return { sort, value, id };
}
