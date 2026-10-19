import type { S3Client } from '@aws-sdk/client-s3';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import storageConfig from '../config/storage.config';
import { S3_INTERNAL_CLIENT, S3_PUBLIC_CLIENT } from './storage.constants';
import { StorageModule } from './storage.module';
import { StorageService } from './storage.service';

describe('StorageModule', () => {
  it('should compile and resolve both S3 clients pointing at the internal and public endpoints', async () => {
    process.env.S3_ENDPOINT = 'http://rustfs:9000';
    process.env.S3_PUBLIC_ENDPOINT = 'http://localhost:9000';
    process.env.S3_BUCKET = 'module-bucket';
    process.env.S3_ACCESS_KEY = 'k';
    process.env.S3_SECRET_KEY = 's';

    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [storageConfig],
        }),
        StorageModule,
      ],
    }).compile();

    const internal = module.get<S3Client>(S3_INTERNAL_CLIENT);
    const external = module.get<S3Client>(S3_PUBLIC_CLIENT);
    const internalEndpoint = await internal.config.endpoint!();
    const publicEndpoint = await external.config.endpoint!();

    expect(module.get(StorageService)).toBeInstanceOf(StorageService);
    expect(internalEndpoint.hostname).toBe('rustfs');
    expect(publicEndpoint.hostname).toBe('localhost');
    // Na versão instalada do SDK, forcePathStyle já chega resolvido como booleano.
    expect(internal.config.forcePathStyle).toBe(true);

    await module.close();
  }, 15000);
});
