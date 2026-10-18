// Roda depois de `dotenv/config` (ordem de `setupFiles`) em ambas as configs do Jest.
// Isola a fila dos testes num schema próprio do pg-boss: o serviço `video-worker` do compose fica
// de pé durante o desenvolvimento e consumiria os jobs `video.process` que as suítes enfileiram
// no schema `pgboss` — mudando `processing_status` no meio de uma asserção.
process.env.QUEUE_SCHEMA = 'pgboss_test';
