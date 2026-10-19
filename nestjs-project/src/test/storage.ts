import {
  AbortMultipartUploadCommand,
  DeleteObjectsCommand,
  ListMultipartUploadsCommand,
  ListObjectsV2Command,
  type S3Client,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';

// Helpers para suítes de integração/e2e contra o storage real do compose (TD-13).
// Cada suíte usa um prefixo próprio para não colidir com outras e limpa só o que criou.

export function testKeyPrefix(suite: string): string {
  return `test/${suite}/${randomUUID()}/`;
}

/** Buffer determinístico de `size` bytes (padrão repetido) para montar partes de upload. */
export function deterministicBuffer(size: number, seed = 0): Buffer {
  const buffer = Buffer.alloc(size);
  for (let i = 0; i < size; i++) {
    buffer[i] = (i + seed) % 251;
  }
  return buffer;
}

/** Remove todos os objetos sob `prefix` (paginado). */
export async function cleanPrefix(
  client: S3Client,
  bucket: string,
  prefix: string,
): Promise<number> {
  let removed = 0;
  let token: string | undefined;
  do {
    const page = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: token,
      }),
    );
    const keys = (page.Contents ?? [])
      .map((object) => object.Key)
      .filter((key): key is string => Boolean(key));
    if (keys.length > 0) {
      await client.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true },
        }),
      );
      removed += keys.length;
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return removed;
}

/** Aborta todas as sessões multipart em andamento sob `prefix`. */
export async function abortAllMultipart(
  client: S3Client,
  bucket: string,
  prefix: string,
): Promise<number> {
  const listing = await client.send(
    new ListMultipartUploadsCommand({ Bucket: bucket, Prefix: prefix }),
  );
  let aborted = 0;
  for (const upload of listing.Uploads ?? []) {
    if (upload.Key && upload.UploadId) {
      await client.send(
        new AbortMultipartUploadCommand({
          Bucket: bucket,
          Key: upload.Key,
          UploadId: upload.UploadId,
        }),
      );
      aborted++;
    }
  }
  return aborted;
}

/** Lista as sessões multipart em andamento sob `prefix` (para asserções). */
export async function listMultipartUploads(
  client: S3Client,
  bucket: string,
  prefix: string,
): Promise<Array<{ key: string; uploadId: string }>> {
  const listing = await client.send(
    new ListMultipartUploadsCommand({ Bucket: bucket, Prefix: prefix }),
  );
  return (listing.Uploads ?? [])
    .filter((upload) => upload.Key && upload.UploadId)
    .map((upload) => ({ key: upload.Key!, uploadId: upload.UploadId! }));
}

/** PUT de uma parte em uma URL pré-assinada; devolve o ETag devolvido pelo storage. */
export async function putPart(url: string, body: Buffer): Promise<string> {
  const response = await fetch(url, {
    method: 'PUT',
    body: new Uint8Array(body),
    headers: { 'Content-Length': String(body.byteLength) },
  });
  if (!response.ok) {
    throw new Error(
      `PUT part failed: ${response.status} ${await response.text()}`,
    );
  }
  const etag = response.headers.get('etag');
  if (!etag) {
    throw new Error('PUT part succeeded without an ETag header');
  }
  return etag;
}
