import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { ValidationExceptionFilter } from '../src/common/filters/validation-exception.filter';

// Global throttler: 10 requests / 60 s per handler per tracker (phase-02-auth/TD-08), probed on a public
// route without its own @Throttle — an unknown channel (404 still counts; `GET /categories` has its own
// 60/min since phase 07). Behind the BFF
// the tracker must be the visitor's IP from X-Forwarded-For — but only when the connection comes from
// a trusted proxy (watch-page/TD-03). Supertest connects over loopback, so `trust proxy = loopback`
// plays the role of TRUST_PROXY = <BFF IP>.
const LIMIT = 10;
const PROBE = '/channels/throttle_probe';

async function bootstrap(trustProxy: string | null) {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication<NestExpressApplication>();
  // Reproduces main.ts — the testing module does not run it.
  if (trustProxy) {
    app.set('trust proxy', trustProxy);
  }
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

  const storage = moduleFixture.get<ThrottlerStorageService>(ThrottlerStorage);
  return { app, storage };
}

async function exhaust(app: NestExpressApplication, forwardedFor: string) {
  for (let i = 0; i < LIMIT; i++) {
    await request(app.getHttpServer())
      .get(PROBE)
      .set('X-Forwarded-For', forwardedFor)
      .expect(404);
  }
}

describe('throttler behind the BFF (e2e)', () => {
  let trusted: Awaited<ReturnType<typeof bootstrap>>;
  let untrusted: Awaited<ReturnType<typeof bootstrap>>;

  beforeAll(async () => {
    trusted = await bootstrap('loopback');
    untrusted = await bootstrap(null);
  });

  beforeEach(() => {
    trusted.storage.storage.clear();
    untrusted.storage.storage.clear();
  });

  afterAll(async () => {
    await trusted.app.close();
    await untrusted.app.close();
  });

  it('gives each forwarded visitor its own budget when the proxy is trusted', async () => {
    await exhaust(trusted.app, '203.0.113.1');

    await request(trusted.app.getHttpServer())
      .get(PROBE)
      .set('X-Forwarded-For', '203.0.113.1')
      .expect(429);
    await request(trusted.app.getHttpServer())
      .get(PROBE)
      .set('X-Forwarded-For', '203.0.113.2')
      .expect(404);
  });

  it('ignores X-Forwarded-For and counts by the socket IP when no proxy is trusted', async () => {
    await exhaust(untrusted.app, '203.0.113.1');

    await request(untrusted.app.getHttpServer())
      .get(PROBE)
      .set('X-Forwarded-For', '203.0.113.2')
      .expect(429);
  });
});
