import type { ConfigModuleOptions, ConfigType } from '@nestjs/config';
import { ConfigModule } from '@nestjs/config';
import type { TypeOrmModuleAsyncOptions } from '@nestjs/typeorm';
import appConfig from './app.config';
import authConfig from './auth.config';
import { ENTITIES } from '../database/entities';
import databaseConfig from './database.config';
import { envValidationSchema } from './env.validation';
import mailConfig from './mail.config';
import queueConfig from './queue.config';
import storageConfig from './storage.config';
import swaggerConfig from './swagger.config';
import uploadConfig from './upload.config';

// Opções compartilhadas pelos dois entrypoints (API em `AppModule`, worker em `WorkerModule`),
// para que ambos leiam o mesmo `.env` com o mesmo schema Joi (phase-03-videos/TD-05).
// O schema é único de propósito: o worker também exige JWT_SECRET/MAIL_* mesmo sem usá-los —
// um `.env` válido para a API é válido para o worker, e vice-versa (ver CLAUDE.md).
export const configModuleOptions: ConfigModuleOptions = {
  isGlobal: true,
  load: [
    appConfig,
    authConfig,
    databaseConfig,
    mailConfig,
    swaggerConfig,
    storageConfig,
    uploadConfig,
    queueConfig,
  ],
  validationSchema: envValidationSchema,
  validationOptions: { allowUnknown: true, abortEarly: false },
};

function postgresOptions(dbConfig: ConfigType<typeof databaseConfig>) {
  return {
    type: 'postgres' as const,
    host: dbConfig.host,
    port: dbConfig.port,
    username: dbConfig.username,
    password: dbConfig.password,
    database: dbConfig.name,
    synchronize: false,
  };
}

/** API: entidades descobertas pelos `forFeature` dos módulos de domínio. */
export const typeOrmModuleAsyncOptions: TypeOrmModuleAsyncOptions = {
  imports: [ConfigModule],
  inject: [databaseConfig.KEY],
  useFactory: (dbConfig: ConfigType<typeof databaseConfig>) => ({
    ...postgresOptions(dbConfig),
    autoLoadEntities: true,
  }),
};

/**
 * Worker: registra o schema inteiro explicitamente. Ele só faz `forFeature([Video])`, mas
 * `Video` referencia `Channel` (→ `User`, …) e o TypeORM exige todas as pontas das relações.
 */
export const typeOrmWorkerModuleAsyncOptions: TypeOrmModuleAsyncOptions = {
  imports: [ConfigModule],
  inject: [databaseConfig.KEY],
  useFactory: (dbConfig: ConfigType<typeof databaseConfig>) => ({
    ...postgresOptions(dbConfig),
    entities: ENTITIES,
  }),
};
