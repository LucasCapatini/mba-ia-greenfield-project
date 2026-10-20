import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListPartsCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import storageConfig from '../config/storage.config';
import {
  S3_INTERNAL_CLIENT,
  S3_PUBLIC_CLIENT,
  STORAGE_NOT_FOUND_ERRORS,
} from './storage.constants';
import { StorageUnavailableException } from './storage.exceptions';

export interface StoragePart {
  partNumber: number;
  etag: string;
  size: number;
}

export interface CompletedPart {
  partNumber: number;
  etag: string;
}

export interface StorageObjectHead {
  contentLength: number;
  contentType: string | null;
}

export interface PresignGetOptions {
  /** Valor literal do header Content-Disposition devolvido pelo storage (download, TD-09). */
  responseContentDisposition?: string;
  /**
   * `true` (default): assina com o cliente PÚBLICO — URL para o navegador.
   * `false`: assina com o cliente INTERNO — URL para o worker (ffprobe/ffmpeg, TD-06).
   */
  public?: boolean;
}

// Única porta de saída para o object storage (phase-03-videos/TD-02, TD-03, TD-09).
// Nenhum byte de vídeo passa por aqui: a API só orquestra metadados do multipart e assina URLs;
// o único upload feito pelo backend é a thumbnail (putObject, TD-06).
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly bucket: string;
  private readonly publicEndpoint: string;

  constructor(
    @Inject(S3_INTERNAL_CLIENT) private readonly internalClient: S3Client,
    @Inject(S3_PUBLIC_CLIENT) private readonly publicClient: S3Client,
    @Inject(storageConfig.KEY)
    config: ConfigType<typeof storageConfig>,
  ) {
    this.bucket = config.bucket;
    this.publicEndpoint = config.publicEndpoint.replace(/\/+$/, '');
  }

  /**
   * URL pública e estável (sem assinatura) de um objeto legível anonimamente pela bucket policy —
   * hoje só `thumbnails/*` (video-channel-management/TD-10). Path-style com o endpoint do
   * navegador (phase-03-videos/TD-02). Para qualquer outro prefixo, use presign.
   */
  publicUrl(key: string): string {
    const path = key.split('/').map(encodeURIComponent).join('/');
    return `${this.publicEndpoint}/${this.bucket}/${path}`;
  }

  /** Abre a sessão multipart; `contentType` fica como metadado do objeto final. */
  async createMultipartUpload(
    key: string,
    contentType: string,
  ): Promise<string> {
    const output = await this.run('createMultipartUpload', () =>
      this.internalClient.send(
        new CreateMultipartUploadCommand({
          Bucket: this.bucket,
          Key: key,
          ContentType: contentType,
        }),
      ),
    );
    if (!output.UploadId) {
      throw new StorageUnavailableException(
        'createMultipartUpload',
        new Error('storage returned no UploadId'),
      );
    }
    return output.UploadId;
  }

  /** URL pré-assinada de UploadPart para o navegador (cliente público). */
  async presignUploadPart(
    key: string,
    uploadId: string,
    partNumber: number,
    expiresInSeconds: number,
  ): Promise<string> {
    return this.run('presignUploadPart', () =>
      getSignedUrl(
        this.publicClient,
        new UploadPartCommand({
          Bucket: this.bucket,
          Key: key,
          UploadId: uploadId,
          PartNumber: partNumber,
        }),
        { expiresIn: expiresInSeconds },
      ),
    );
  }

  /**
   * Partes já aceitas pelo storage (base da retomada, TD-03). Pagina até esgotar.
   * Devolve `null` quando a sessão multipart não existe mais (abortada/completada).
   */
  async listParts(
    key: string,
    uploadId: string,
  ): Promise<StoragePart[] | null> {
    const parts: StoragePart[] = [];
    let marker: number | undefined;
    do {
      const output = await this.runOrNull('listParts', () =>
        this.internalClient.send(
          new ListPartsCommand({
            Bucket: this.bucket,
            Key: key,
            UploadId: uploadId,
            PartNumberMarker: marker === undefined ? undefined : String(marker),
          }),
        ),
      );
      if (output === null) {
        return null;
      }
      for (const part of output.Parts ?? []) {
        if (part.PartNumber !== undefined && part.ETag) {
          parts.push({
            partNumber: part.PartNumber,
            etag: part.ETag,
            size: part.Size ?? 0,
          });
        }
      }
      marker =
        output.IsTruncated && output.NextPartNumberMarker !== undefined
          ? Number(output.NextPartNumberMarker)
          : undefined;
    } while (marker !== undefined);
    return parts.sort((a, b) => a.partNumber - b.partNumber);
  }

  /** Fecha o multipart com a lista de partes mantida pelo cliente (ordenada por número). */
  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: CompletedPart[],
  ): Promise<void> {
    const ordered = [...parts].sort((a, b) => a.partNumber - b.partNumber);
    await this.run('completeMultipartUpload', () =>
      this.internalClient.send(
        new CompleteMultipartUploadCommand({
          Bucket: this.bucket,
          Key: key,
          UploadId: uploadId,
          MultipartUpload: {
            Parts: ordered.map((part) => ({
              PartNumber: part.partNumber,
              ETag: part.etag,
            })),
          },
        }),
      ),
    );
  }

  /** Aborta a sessão; tolerante a sessões já inexistentes (idempotente para TD-12). */
  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    await this.runOrNull('abortMultipartUpload', () =>
      this.internalClient.send(
        new AbortMultipartUploadCommand({
          Bucket: this.bucket,
          Key: key,
          UploadId: uploadId,
        }),
      ),
    );
  }

  /** Metadados do objeto ou `null` quando não existe. */
  async headObject(key: string): Promise<StorageObjectHead | null> {
    const output = await this.runOrNull('headObject', () =>
      this.internalClient.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      ),
    );
    if (output === null) {
      return null;
    }
    return {
      contentLength: output.ContentLength ?? 0,
      contentType: output.ContentType ?? null,
    };
  }

  /** Upload simples pelo backend (thumbnail gerada pelo worker, TD-06). */
  async putObject(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<void> {
    await this.run('putObject', () =>
      this.internalClient.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
          ContentLength: body.byteLength,
        }),
      ),
    );
  }

  async deleteObject(key: string): Promise<void> {
    await this.run('deleteObject', () =>
      this.internalClient.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      ),
    );
  }

  /**
   * URL GET pré-assinada. O storage atende `Range` (206) e, com `responseContentDisposition`,
   * devolve o header Content-Disposition — streaming e download da TD-09.
   */
  async presignGetObject(
    key: string,
    expiresInSeconds: number,
    options: PresignGetOptions = {},
  ): Promise<string> {
    const client =
      options.public === false ? this.internalClient : this.publicClient;
    return this.run('presignGetObject', () =>
      getSignedUrl(
        client,
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
          ResponseContentDisposition: options.responseContentDisposition,
        }),
        { expiresIn: expiresInSeconds },
      ),
    );
  }

  private async run<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      this.logger.error(
        `Storage operation "${operation}" failed: ${
          error instanceof Error
            ? `${error.name}: ${error.message}`
            : String(error)
        }`,
      );
      throw new StorageUnavailableException(operation, error);
    }
  }

  private async runOrNull<T>(
    operation: string,
    fn: () => Promise<T>,
  ): Promise<T | null> {
    try {
      return await fn();
    } catch (error) {
      if (StorageService.isNotFound(error)) {
        return null;
      }
      this.logger.error(
        `Storage operation "${operation}" failed: ${
          error instanceof Error
            ? `${error.name}: ${error.message}`
            : String(error)
        }`,
      );
      throw new StorageUnavailableException(operation, error);
    }
  }

  private static isNotFound(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }
    const status = (error as { $metadata?: { httpStatusCode?: number } })
      .$metadata?.httpStatusCode;
    return (
      (STORAGE_NOT_FOUND_ERRORS as readonly string[]).includes(error.name) ||
      status === 404
    );
  }
}
