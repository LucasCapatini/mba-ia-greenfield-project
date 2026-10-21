import { registerAs } from '@nestjs/config';

// Fila pg-boss sobre o PostgreSQL já existente — phase-03-videos/TD-04.
// A conexão vem de `databaseConfig`; aqui ficam só o schema próprio do pg-boss e
// se este processo supervisiona a fila (worker: sim; API: não, para não duplicar).
export default registerAs('queue', () => ({
  schema: process.env.QUEUE_SCHEMA ?? 'pgboss',
  supervise: (process.env.QUEUE_SUPERVISE ?? 'true') === 'true',
}));
