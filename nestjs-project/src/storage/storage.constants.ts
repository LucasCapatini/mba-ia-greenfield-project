// Tokens dos dois clientes S3 (phase-03-upload-processing/TD-02):
// - INTERNAL: chamadas da API/worker ao storage pelo host interno (S3_ENDPOINT).
// - PUBLIC: usado SOMENTE para assinar URLs que o navegador consome (S3_PUBLIC_ENDPOINT);
//   a assinatura SigV4 inclui o host, então o cliente que assina precisa apontar para o host
//   que o navegador vai acessar.
export const S3_INTERNAL_CLIENT = Symbol('S3_INTERNAL_CLIENT');
export const S3_PUBLIC_CLIENT = Symbol('S3_PUBLIC_CLIENT');

export const STORAGE_ERROR_CODES = {
  UNAVAILABLE: 'STORAGE_UNAVAILABLE',
} as const;

// Nomes de erro do S3 que significam "não existe" e viram `null` em vez de exceção.
export const STORAGE_NOT_FOUND_ERRORS = [
  'NoSuchUpload',
  'NoSuchKey',
  'NotFound',
] as const;
