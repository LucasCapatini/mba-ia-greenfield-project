import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker/worker.module';

// Segundo entrypoint do subprojeto (phase-03-upload-processing/TD-05): contexto de aplicação sem
// servidor HTTP. `enableShutdownHooks` faz SIGTERM/SIGINT chamarem `app.close()`, que dispara
// `QueueService.onModuleDestroy` (`boss.stop({ graceful: true })`) e fecha o DataSource — assim o
// `docker compose stop` encerra o processo sem SIGKILL e sem abandonar jobs no meio.
async function bootstrap(): Promise<void> {
  const logger = new Logger('Worker');
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    bufferLogs: true,
  });
  app.enableShutdownHooks();
  app.flushLogs();
  logger.log(`Video worker started (pid ${process.pid})`);

  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.once(signal, () => {
      logger.log(`${signal} received — shutting down`);
      // `enableShutdownHooks` já encerra o contexto; este listener só torna o log explícito.
    });
  }
}

bootstrap().catch((err: unknown) => {
  new Logger('Worker').error(
    `Worker failed to start: ${err instanceof Error ? err.stack : String(err)}`,
  );
  process.exit(1);
});
