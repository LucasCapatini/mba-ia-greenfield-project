import { ConfigModule, type ConfigType } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import type { ValidationResult } from 'joi';
import { envValidationSchema } from './env.validation';
import queueConfig from './queue.config';
import storageConfig from './storage.config';
import uploadConfig from './upload.config';

const requiredEnv = {
  DB_USERNAME: 'user',
  DB_PASSWORD: 'pass',
  DB_NAME: 'db',
  JWT_SECRET: 'secret',
  JWT_REFRESH_SECRET: 'refresh-secret',
  FRONTEND_URL: 'http://localhost:3001',
  S3_ENDPOINT: 'http://rustfs:9000',
  S3_PUBLIC_ENDPOINT: 'http://localhost:9000',
  S3_ACCESS_KEY: 'streamtube',
  S3_SECRET_KEY: 'streamtube-secret',
  S3_BUCKET: 'streamtube-videos',
};

const validate = (
  env: Record<string, string>,
): ValidationResult<Record<string, unknown>> =>
  envValidationSchema.validate(
    { ...requiredEnv, ...env },
    { allowUnknown: true, abortEarly: false },
  );

describe('envValidationSchema — SWAGGER_ENABLED', () => {
  it('should reject SWAGGER_ENABLED with an invalid value', () => {
    const { error } = validate({ SWAGGER_ENABLED: 'invalid' });
    expect(error).toBeDefined();
    expect(error!.message).toContain('SWAGGER_ENABLED');
  });

  it('should accept SWAGGER_ENABLED=true', () => {
    const { error } = validate({ SWAGGER_ENABLED: 'true' });
    expect(error).toBeUndefined();
  });

  it('should accept SWAGGER_ENABLED=false', () => {
    const { error } = validate({ SWAGGER_ENABLED: 'false' });
    expect(error).toBeUndefined();
  });

  it('should apply default false when SWAGGER_ENABLED is not set', () => {
    const result = validate({});
    expect(result.error).toBeUndefined();
    const value = result.value as Record<string, unknown>;
    expect(value.SWAGGER_ENABLED).toBe('false');
  });
});

describe('storage / upload / queue config factories (real .env from the container)', () => {
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [storageConfig, uploadConfig, queueConfig],
          validationSchema: envValidationSchema,
          validationOptions: { allowUnknown: true, abortEarly: false },
        }),
      ],
    }).compile();
  });

  afterAll(async () => {
    await module.close();
  });

  it('should expose the storage namespace with the Compose service name as internal endpoint', () => {
    const storage = module.get<ConfigType<typeof storageConfig>>(
      storageConfig.KEY,
    );

    expect(storage.endpoint).toBe(process.env.S3_ENDPOINT);
    expect(storage.publicEndpoint).toBe(process.env.S3_PUBLIC_ENDPOINT);
    expect(storage.endpoint).not.toContain('localhost');
    expect(storage.bucket).toBe(process.env.S3_BUCKET);
    expect(storage.accessKey).toBe(process.env.S3_ACCESS_KEY);
    expect(storage.forcePathStyle).toBe(true);
  });

  it('should expose the upload namespace as numbers (bytes and seconds)', () => {
    const upload = module.get<ConfigType<typeof uploadConfig>>(
      uploadConfig.KEY,
    );

    expect(upload.partSize).toBe(Number(process.env.UPLOAD_PART_SIZE));
    expect(upload.partSize).toBeGreaterThanOrEqual(5 * 1024 * 1024);
    expect(upload.maxBytes).toBe(Number(process.env.UPLOAD_MAX_BYTES));
    expect(upload.urlTtlSeconds).toBe(Number(process.env.UPLOAD_URL_TTL));
    expect(upload.sessionTtlSeconds).toBe(Number(process.env.UPLOAD_TTL));
    expect(upload.playbackUrlTtlSeconds).toBe(
      Number(process.env.PLAYBACK_URL_TTL),
    );
  });

  it('should expose the queue namespace', () => {
    const queue = module.get<ConfigType<typeof queueConfig>>(queueConfig.KEY);

    expect(queue.schema).toBe(process.env.QUEUE_SCHEMA);
    expect(typeof queue.supervise).toBe('boolean');
  });
});
