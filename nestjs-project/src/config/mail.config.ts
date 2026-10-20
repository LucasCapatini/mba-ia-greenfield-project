import { registerAs } from '@nestjs/config';

export default registerAs('mail', () => ({
  host: process.env.MAIL_HOST || 'mailpit',
  port: parseInt(process.env.MAIL_PORT || '1025', 10),
  from: process.env.MAIL_FROM || '"StreamTube" <noreply@streamtube.com>',
  // Provedor SMTP de produção (home-search-production/TD-09); ausentes em dev (Mailpit).
  user: process.env.MAIL_USER || undefined,
  password: process.env.MAIL_PASSWORD || undefined,
  secure: process.env.MAIL_SECURE === 'true',
}));
