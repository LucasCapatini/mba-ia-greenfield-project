import { S3Client } from '@aws-sdk/client-s3';
import { Module } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import storageConfig from '../config/storage.config';
import { S3_INTERNAL_CLIENT, S3_PUBLIC_CLIENT } from './storage.constants';
import { StorageService } from './storage.service';

type StorageConfig = ConfigType<typeof storageConfig>;

// Configuração comum aos dois clientes (TD-02):
// - forcePathStyle: bucket no path (`http://host:9000/bucket/key`), não como subdomínio;
// - checksums WHEN_REQUIRED: desde a 3.729.0 o SDK calcula CRC32 por padrão e anexa
//   headers/trailers que servidores S3-compatíveis podem recusar.
function createClient(config: StorageConfig, endpoint: string): S3Client {
  return new S3Client({
    endpoint,
    region: config.region,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKey,
      secretAccessKey: config.secretKey,
    },
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
}

@Module({
  providers: [
    {
      provide: S3_INTERNAL_CLIENT,
      inject: [storageConfig.KEY],
      useFactory: (config: StorageConfig) =>
        createClient(config, config.endpoint),
    },
    {
      provide: S3_PUBLIC_CLIENT,
      inject: [storageConfig.KEY],
      useFactory: (config: StorageConfig) =>
        createClient(config, config.publicEndpoint),
    },
    StorageService,
  ],
  exports: [StorageService, S3_INTERNAL_CLIENT],
})
export class StorageModule {}
