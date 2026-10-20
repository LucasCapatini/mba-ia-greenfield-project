import { ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { DomainExceptionFilter } from '../../src/common/filters/domain-exception.filter';
import { ValidationExceptionFilter } from '../../src/common/filters/validation-exception.filter';
import type { User } from '../../src/users/entities/user.entity';

/**
 * App de E2E das interações sociais (Fase 06). Reproduz o `main.ts` (pipes, filtros e
 * `trust proxy` em loopback, para o `X-Forwarded-For` do supertest definir o visitante). Os
 * cenários semeiam usuários/canais/vídeos direto no banco (`src/test/social-fixtures.ts`) e
 * assinam o access token com o `JwtService` da app — o `JwtAuthGuard` só verifica a assinatura,
 * então o resultado é o mesmo do login, sem e-mail nem storage.
 */
export interface SocialApp {
  app: NestExpressApplication;
  dataSource: DataSource;
  jwt: JwtService;
  throttler: ThrottlerStorageService;
}

export async function bootstrapSocialApp(): Promise<SocialApp> {
  process.env.S3_PUBLIC_ENDPOINT = process.env.S3_ENDPOINT;

  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication<NestExpressApplication>();
  app.set('trust proxy', 'loopback');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(
    new DomainExceptionFilter(),
    new ValidationExceptionFilter(),
  );
  await app.init();

  return {
    app,
    dataSource: moduleFixture.get(DataSource),
    jwt: moduleFixture.get(JwtService, { strict: false }),
    throttler: moduleFixture.get<ThrottlerStorageService>(ThrottlerStorage),
  };
}

/** Mesmo payload do access token emitido no login (`{ sub, email }`). */
export function bearerFor(jwt: JwtService, user: User): string {
  return `Bearer ${jwt.sign({ sub: user.id, email: user.email })}`;
}

export type ErrorBody = {
  statusCode: number;
  error: string;
  message: string | string[];
};
