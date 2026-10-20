import { MAILER_OPTIONS, type MailerOptions } from '@nestjs-modules/mailer';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import appConfig from '../config/app.config';
import mailConfig from '../config/mail.config';
import { MailModule } from './mail.module';

const MAIL_KEYS = ['MAIL_USER', 'MAIL_PASSWORD', 'MAIL_SECURE'] as const;

async function compileWith(
  env: Partial<Record<(typeof MAIL_KEYS)[number], string>>,
) {
  for (const key of MAIL_KEYS) {
    if (env[key] === undefined) delete process.env[key];
    else process.env[key] = env[key];
  }
  return Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, load: [appConfig, mailConfig] }),
      MailModule,
    ],
  }).compile();
}

describe('MailModule', () => {
  const original = Object.fromEntries(
    MAIL_KEYS.map((key) => [key, process.env[key]]),
  );

  afterEach(() => {
    for (const key of MAIL_KEYS) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  });

  it('should compile with the Mailpit transport (no credentials, no TLS)', async () => {
    const module = await compileWith({});

    const options = module.get<MailerOptions>(MAILER_OPTIONS);
    expect(options.transport).toEqual({
      host: expect.any(String) as string,
      port: expect.any(Number) as number,
      secure: false,
    });
    await module.close();
  }, 15000);

  it('should compile with an authenticated TLS transport when the credentials are set', async () => {
    const module = await compileWith({
      MAIL_USER: 'apikey',
      MAIL_PASSWORD: 'secret',
      MAIL_SECURE: 'true',
    });

    const options = module.get<MailerOptions>(MAILER_OPTIONS);
    expect(options.transport).toMatchObject({
      secure: true,
      auth: { user: 'apikey', pass: 'secret' },
    });
    await module.close();
  }, 15000);
});
