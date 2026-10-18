import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  url: process.env.APP_URL ?? 'http://localhost:3000',
  // Base URL do frontend (Next.js) — destino dos links enviados por e-mail.
  // Obrigatória no schema Joi (env.validation.ts); o fallback vazio nunca é
  // alcançado em runtime, existe só para manter a factory chamável como função.
  frontendUrl: process.env.FRONTEND_URL ?? '',
}));
