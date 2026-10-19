import { DomainException } from '../common/exceptions/domain.exception';
import { STORAGE_ERROR_CODES } from './storage.constants';

// Falha de chamada ao object storage (rede, credenciais, resposta inesperada) — Error Catalog
// da Fase 03: 503 STORAGE_UNAVAILABLE. Erros "não existe" (NoSuchUpload/NoSuchKey) nunca
// chegam aqui: o StorageService os devolve como `null` para o domínio decidir o erro HTTP.
export class StorageUnavailableException extends DomainException {
  constructor(operation: string, cause?: unknown) {
    const reason =
      cause instanceof Error ? `${cause.name}: ${cause.message}` : 'unknown';
    super(
      STORAGE_ERROR_CODES.UNAVAILABLE,
      503,
      `Storage operation "${operation}" failed (${reason})`,
    );
  }
}
