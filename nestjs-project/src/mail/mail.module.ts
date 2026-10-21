import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/adapters/handlebars.adapter';
import { Module } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { join } from 'path';
import mailConfig from '../config/mail.config';
import { MailService } from './mail.service';

/**
 * SMTP transport: Mailpit in dev (host + port, no auth, no TLS); with `MAIL_USER` the production
 * provider gets credentials, and `MAIL_SECURE` turns on implicit TLS (home-search-production/TD-09).
 */
export function mailTransport(mail: ConfigType<typeof mailConfig>) {
  return {
    host: mail.host,
    port: mail.port,
    secure: mail.secure,
    ...(mail.user ? { auth: { user: mail.user, pass: mail.password } } : {}),
  };
}

@Module({
  imports: [
    MailerModule.forRootAsync({
      inject: [mailConfig.KEY],
      useFactory: (mail: ConfigType<typeof mailConfig>) => ({
        transport: mailTransport(mail),
        defaults: {
          from: mail.from,
        },
        template: {
          dir: join(__dirname, 'templates'),
          adapter: new HandlebarsAdapter(),
          options: { strict: true },
        },
      }),
    }),
  ],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
