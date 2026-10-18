// Generated from specs/auth-confirm-email.plan.md (SI-5 — saneamento-fase-02-e-infra/TD-03).
// One test.describe per spec; one test per scenario; group headings kept as comments.
import * as crypto from 'crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource, Repository } from 'typeorm';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import { AppModule } from '../src/app.module';
import { VerificationToken } from '../src/auth/entities/verification-token.entity';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { ValidationExceptionFilter } from '../src/common/filters/validation-exception.filter';
import { MailService } from '../src/mail/mail.service';
import { User } from '../src/users/entities/user.entity';
import { cleanAllTables } from '../src/test/create-test-data-source';

const PASSWORD = 'password123';

type ErrorBody = {
  statusCode: number;
  error: string;
  message: string | string[];
};

function errorBody(res: request.Response): ErrorBody {
  return res.body as ErrorBody;
}

function sha256(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

describe('auth-confirm-email', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let verificationTokenRepository: Repository<VerificationToken>;
  let userRepository: Repository<User>;
  let mailService: MailService;
  let throttlerStorage: ThrottlerStorageService;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Reproduces main.ts — the testing module does not run it.
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

    dataSource = moduleFixture.get(DataSource);
    verificationTokenRepository = dataSource.getRepository(VerificationToken);
    userRepository = dataSource.getRepository(User);
    mailService = moduleFixture.get(MailService);
    throttlerStorage =
      moduleFixture.get<ThrottlerStorageService>(ThrottlerStorage);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await cleanAllTables(dataSource);
    throttlerStorage.storage.clear();
  });

  /** Registers `email` and returns the raw confirmation token captured from the MailService spy. */
  async function captureConfirmationToken(email: string): Promise<string> {
    let captured = '';
    jest
      .spyOn(mailService, 'sendConfirmationEmail')
      .mockImplementationOnce(
        (_to: string, _name: string, token: string): Promise<void> => {
          captured = token;
          return Promise.resolve();
        },
      );

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: PASSWORD })
      .expect(201);

    return captured;
  }

  /** Registers + confirms `email`, requests a reset and returns the raw reset token. */
  async function captureResetToken(email: string): Promise<string> {
    const confirmToken = await captureConfirmationToken(email);
    await request(app.getHttpServer())
      .get('/auth/confirm-email')
      .query({ token: confirmToken })
      .expect(204);

    let captured = '';
    jest
      .spyOn(mailService, 'sendPasswordResetEmail')
      .mockImplementationOnce(
        (_to: string, _name: string, token: string): Promise<void> => {
          captured = token;
          return Promise.resolve();
        },
      );

    await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email })
      .expect(204);

    return captured;
  }

  // ### 1. GET /auth/confirm-email

  test('1.1 valid-token-confirms-account', async () => {
    const email = 'confirm-ok@example.com';
    const token = await captureConfirmationToken(email);

    const res = await request(app.getHttpServer())
      .get('/auth/confirm-email')
      .query({ token })
      .expect(204);
    expect(res.body).toEqual({});

    const user = await userRepository.findOneBy({ email });
    expect(user?.is_confirmed).toBe(true);

    const record = await verificationTokenRepository.findOneBy({
      token_hash: sha256(token),
    });
    expect(record?.used_at).toBeInstanceOf(Date);
  });

  test('1.2 repeated-token-is-idempotent', async () => {
    const email = 'confirm-twice@example.com';
    const token = await captureConfirmationToken(email);

    await request(app.getHttpServer())
      .get('/auth/confirm-email')
      .query({ token })
      .expect(204);

    const first = await verificationTokenRepository.findOneBy({
      token_hash: sha256(token),
    });
    const firstUsedAt = first?.used_at;
    expect(firstUsedAt).toBeInstanceOf(Date);

    // Simulates the e-mail client prefetch followed by the real click.
    const res = await request(app.getHttpServer())
      .get('/auth/confirm-email')
      .query({ token })
      .expect(204);
    expect(res.body).toEqual({});

    const second = await verificationTokenRepository.findOneBy({
      token_hash: sha256(token),
    });
    expect(second?.used_at?.getTime()).toBe(firstUsedAt?.getTime());

    const user = await userRepository.findOneBy({ email });
    expect(user?.is_confirmed).toBe(true);
  });

  test('1.3 unknown-token-returns-invalid-token', async () => {
    const res = await request(app.getHttpServer())
      .get('/auth/confirm-email')
      .query({ token: `does-not-exist-${crypto.randomUUID()}` })
      .expect(401);

    expect(errorBody(res)).toMatchObject({
      statusCode: 401,
      error: 'INVALID_TOKEN',
    });
    expect(typeof errorBody(res).message).toBe('string');

    expect(await userRepository.count()).toBe(0);
  });

  test('1.4 expired-unused-token-returns-token-expired', async () => {
    const email = 'confirm-expired@example.com';
    const token = await captureConfirmationToken(email);

    const update = await verificationTokenRepository.update(
      { token_hash: sha256(token) },
      { expires_at: new Date(0) },
    );
    expect(update.affected).toBe(1);

    const res = await request(app.getHttpServer())
      .get('/auth/confirm-email')
      .query({ token })
      .expect(401);
    expect(errorBody(res).error).toBe('TOKEN_EXPIRED');

    const user = await userRepository.findOneBy({ email });
    expect(user?.is_confirmed).toBe(false);

    const record = await verificationTokenRepository.findOneBy({
      token_hash: sha256(token),
    });
    expect(record?.used_at).toBeNull();
  });

  // ### 2. POST /auth/reset-password — regressão single-use

  test('2.1 reset-token-reuse-stays-single-use', async () => {
    const email = 'reset-once@example.com';
    const token = await captureResetToken(email);

    await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token, new_password: 'newpassword123' })
      .expect(204);

    const reuse = await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token, new_password: 'anotherpass123' })
      .expect(401);
    expect(errorBody(reuse).error).toBe('INVALID_TOKEN');

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'newpassword123' })
      .expect(200);

    const rejected = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'anotherpass123' })
      .expect(401);
    expect(errorBody(rejected).error).toBe('INVALID_CREDENTIALS');
  });
});
