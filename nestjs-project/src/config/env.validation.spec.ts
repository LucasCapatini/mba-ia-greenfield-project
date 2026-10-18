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
