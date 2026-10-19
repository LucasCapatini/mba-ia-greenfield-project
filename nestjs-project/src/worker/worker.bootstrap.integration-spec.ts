import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { QUEUE_NAMES } from '../queue/queue.constants';
import { QueueService } from '../queue/queue.service';
import { StorageService } from '../storage/storage.service';
import { WorkerModule } from './worker.module';

// Espelha `src/worker.ts`: o entrypoint não é importado porque executa `bootstrap()` ao carregar.
describe('Worker bootstrap (integration — DB, pg-boss e RustFS reais)', () => {
  let app: INestApplicationContext;

  afterAll(async () => {
    // Idempotente: o teste de shutdown já fechou; aqui só garante que nada fica aberto se ele falhar.
    await app?.close().catch(() => undefined);
  });

  it('should start as an application context with the queues registered and no HTTP server', async () => {
    app = await NestFactory.createApplicationContext(WorkerModule, {
      logger: false,
    });
    app.enableShutdownHooks();

    const queue = app.get(QueueService);
    await expect(queue.hasQueue(QUEUE_NAMES.VIDEO_PROCESS)).resolves.toBe(true);
    await expect(queue.hasQueue(QUEUE_NAMES.UPLOAD_EXPIRE)).resolves.toBe(true);
    expect(app.get(StorageService)).toBeInstanceOf(StorageService);
    expect(app.get(DataSource).isInitialized).toBe(true);
    // Contexto de aplicação: não existe `listen`/servidor HTTP.
    expect((app as unknown as { listen?: unknown }).listen).toBeUndefined();
  }, 30000);

  it('should close cleanly: pg-boss stopped and DataSource destroyed within the graceful window', async () => {
    const dataSource = app.get(DataSource);
    const startedAt = Date.now();

    await app.close();

    expect(Date.now() - startedAt).toBeLessThan(10_000);
    expect(dataSource.isInitialized).toBe(false);
  }, 30000);
});
