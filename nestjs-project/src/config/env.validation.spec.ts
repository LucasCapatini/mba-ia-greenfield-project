import type { ValidationResult } from 'joi';
import { envValidationSchema } from './env.validation';

type Env = Record<string, unknown>;

const validEnv: Env = {
  DB_USERNAME: 'streamtube',
  DB_PASSWORD: 'streamtube',
  DB_NAME: 'streamtube',
  JWT_SECRET: 'secret',
  JWT_REFRESH_SECRET: 'refresh-secret',
  FRONTEND_URL: 'http://localhost:3001',
  S3_ENDPOINT: 'http://rustfs:9000',
  S3_PUBLIC_ENDPOINT: 'http://localhost:9000',
  S3_ACCESS_KEY: 'streamtube',
  S3_SECRET_KEY: 'streamtube-secret',
  S3_BUCKET: 'streamtube-videos',
};

function validate(env: Env): ValidationResult<Env> {
  return envValidationSchema.validate(env, {
    allowUnknown: true,
    abortEarly: false,
  }) as ValidationResult<Env>;
}

function without(env: Env, key: string): Env {
  return Object.fromEntries(Object.entries(env).filter(([k]) => k !== key));
}

describe('envValidationSchema — FRONTEND_URL', () => {
  it('accepts a valid absolute URL', () => {
    const result = validate(validEnv);

    expect(result.error).toBeUndefined();
    expect(result.value).toMatchObject({
      FRONTEND_URL: 'http://localhost:3001',
    });
  });

  it('rejects a missing FRONTEND_URL (no default — the backend must know where e-mail links land)', () => {
    const { error } = validate(without(validEnv, 'FRONTEND_URL'));

    expect(error).toBeDefined();
    expect(error?.details.map((d) => d.path.join('.'))).toContain(
      'FRONTEND_URL',
    );
  });

  it('rejects a FRONTEND_URL that is not a URI', () => {
    const { error } = validate({ ...validEnv, FRONTEND_URL: 'nao-e-url' });

    expect(error).toBeDefined();
    expect(error?.details[0].path).toEqual(['FRONTEND_URL']);
    expect(error?.details[0].type).toBe('string.uri');
  });
});

describe('envValidationSchema — storage (S3_*)', () => {
  it('accepts the dev storage keys and applies region/path-style defaults', () => {
    const result = validate(validEnv);

    expect(result.error).toBeUndefined();
    expect(result.value).toMatchObject({
      S3_REGION: 'us-east-1',
      S3_FORCE_PATH_STYLE: 'true',
    });
  });

  it.each(['S3_ENDPOINT', 'S3_SECRET_KEY', 'S3_ACCESS_KEY', 'S3_BUCKET'])(
    'rejects a missing %s (no default — the API must not boot without storage credentials)',
    (key) => {
      const { error } = validate(without(validEnv, key));

      expect(error).toBeDefined();
      expect(error?.details.map((d) => d.path.join('.'))).toContain(key);
    },
  );

  it('rejects an S3_ENDPOINT without an http/https scheme (host:port is not enough for the SDK)', () => {
    const { error } = validate({ ...validEnv, S3_ENDPOINT: 'rustfs:9000' });

    expect(error).toBeDefined();
    expect(error?.details[0].path).toEqual(['S3_ENDPOINT']);
    expect(error?.details[0].type).toBe('string.uriCustomScheme');
  });

  it('rejects an S3_PUBLIC_ENDPOINT that is not a URI at all', () => {
    const { error } = validate({
      ...validEnv,
      S3_PUBLIC_ENDPOINT: 'nao e url',
    });

    expect(error).toBeDefined();
    expect(error?.details[0].path).toEqual(['S3_PUBLIC_ENDPOINT']);
  });
});

describe('envValidationSchema — upload policy (UPLOAD_*, PLAYBACK_URL_TTL)', () => {
  it('applies the documented defaults when the keys are absent', () => {
    const result = validate(validEnv);
    const value = result.value as Record<string, unknown>;

    expect(result.error).toBeUndefined();
    expect(value).toMatchObject({
      UPLOAD_PART_SIZE: 64 * 1024 * 1024,
      UPLOAD_MAX_BYTES: 10 * 1024 * 1024 * 1024,
      UPLOAD_URL_TTL: 3600,
      UPLOAD_TTL: 86400,
      PLAYBACK_URL_TTL: 43200,
      QUEUE_SCHEMA: 'pgboss',
      QUEUE_SUPERVISE: 'true',
    });
  });

  it('rejects UPLOAD_PART_SIZE below the 5 MiB S3 minimum', () => {
    const { error } = validate({ ...validEnv, UPLOAD_PART_SIZE: '1048576' });

    expect(error).toBeDefined();
    expect(error?.details[0].path).toEqual(['UPLOAD_PART_SIZE']);
    expect(error?.details[0].type).toBe('number.min');
  });

  it('accepts the 5 MiB part size the test suites use and coerces it to a number', () => {
    const result = validate({
      ...validEnv,
      UPLOAD_PART_SIZE: '5242880',
    });
    const value = result.value as Record<string, unknown>;

    expect(result.error).toBeUndefined();
    expect(value.UPLOAD_PART_SIZE).toBe(5242880);
  });
});
