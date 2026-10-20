import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().port().default(3000),
  DB_HOST: Joi.string().default('localhost'),
  DB_PORT: Joi.number().default(5432),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_NAME: Joi.string().required(),
  JWT_SECRET: Joi.string().required(),
  JWT_REFRESH_SECRET: Joi.string().required(),
  JWT_ACCESS_EXPIRATION: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRATION: Joi.string().default('7d'),
  CONFIRMATION_TOKEN_EXPIRATION_HOURS: Joi.number().default(1),
  PASSWORD_RESET_TOKEN_EXPIRATION_HOURS: Joi.number().default(1),
  APP_URL: Joi.string().uri().default('http://localhost:3000'),
  FRONTEND_URL: Joi.string().uri().required(),
  MAIL_HOST: Joi.string().default('mailpit'),
  MAIL_PORT: Joi.number().default(1025),
  MAIL_FROM: Joi.string().default('"StreamTube" <noreply@streamtube.com>'),
  SWAGGER_ENABLED: Joi.string().valid('true', 'false').default('false'),
  // IP(s) do proxy confiável — o BFF next-frontend (watch-page/TD-03). Ausente → `trust proxy`
  // desligado e o throttler rastreia o IP do socket. Lista separada por vírgula de IPs/CIDRs.
  TRUST_PROXY: Joi.string().custom((value: string, helpers) => {
    const ip = Joi.string().ip({ cidr: 'optional' });
    const entries = value.split(',').map((entry) => entry.trim());
    const valid = entries.every(
      (entry) => entry !== '' && ip.validate(entry).error === undefined,
    );
    return valid ? value : helpers.error('any.invalid');
  }),
  // Object storage S3-compatível (phase-03-upload-processing/TD-01, TD-02)
  // Somente http/https: o SDK S3 exige esquema explícito (`rustfs:9000` seria um URI válido para o Joi).
  S3_ENDPOINT: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .required(),
  S3_PUBLIC_ENDPOINT: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .required(),
  S3_REGION: Joi.string().default('us-east-1'),
  S3_ACCESS_KEY: Joi.string().required(),
  S3_SECRET_KEY: Joi.string().required(),
  S3_BUCKET: Joi.string().required(),
  S3_FORCE_PATH_STYLE: Joi.string().valid('true', 'false').default('true'),
  // Upload / playback (TD-03, TD-09, TD-12) — bytes e segundos
  UPLOAD_PART_SIZE: Joi.number()
    .integer()
    .min(5 * 1024 * 1024)
    .max(5 * 1024 * 1024 * 1024)
    .default(64 * 1024 * 1024),
  UPLOAD_MAX_BYTES: Joi.number()
    .integer()
    .min(1)
    .default(10 * 1024 * 1024 * 1024),
  UPLOAD_URL_TTL: Joi.number().integer().min(60).default(3600),
  UPLOAD_TTL: Joi.number().integer().min(60).default(86400),
  PLAYBACK_URL_TTL: Joi.number().integer().min(60).default(43200),
  // Thumbnail customizada enviada pela API (video-channel-management/TD-04) — bytes
  THUMBNAIL_MAX_BYTES: Joi.number()
    .integer()
    .min(1)
    .max(50 * 1024 * 1024)
    .default(5 * 1024 * 1024),
  // Fila pg-boss (TD-04)
  QUEUE_SCHEMA: Joi.string().default('pgboss'),
  QUEUE_SUPERVISE: Joi.string().valid('true', 'false').default('true'),
});
