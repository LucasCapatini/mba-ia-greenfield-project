import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { PgBoss } from 'pg-boss';
import databaseConfig from '../config/database.config';
import queueConfig from '../config/queue.config';
import {
  QUEUE_NAMES,
  QUEUE_POLICY,
  QUEUE_SEND_DEFAULTS,
  type QueueName,
  type QueuePayloads,
} from './queue.constants';

/** Forma estrutural do `IDatabase` do pg-boss: qualquer executor SQL (ex.: QueryRunner em transação). */
export interface QueueDatabase {
  executeSql(text: string, values?: unknown[]): Promise<{ rows: any[] }>;
}

export interface QueueSendOptions {
  /** Obrigatória: garante um job ativo por chave (idempotência por vídeo). */
  singletonKey: string;
  /** Atraso absoluto (Date) ou relativo em segundos. */
  startAfter?: Date | number;
  retryLimit?: number;
  retryDelay?: number;
  retryBackoff?: boolean;
  expireInSeconds?: number;
  /**
   * Conexão que já está em transação (ex.: QueryRunner do TypeORM adaptado a `executeSql`) —
   * faz o `send` participar da transação do domínio (TD-11).
   */
  db?: QueueDatabase;
}

export interface QueueWorkOptions {
  batchSize?: number;
  pollingIntervalSeconds?: number;
}

export type QueueJob<Q extends QueueName> = {
  id: string;
  name: Q;
  data: QueuePayloads[Q];
  retryCount: number;
};

export type QueueJobHandler<Q extends QueueName> = (
  jobs: QueueJob<Q>[],
) => Promise<void>;

// Wrapper fino do pg-boss (phase-03-videos/TD-04): fila sobre o PostgreSQL já
// existente, schema próprio (`pgboss`) criado/migrado em `start()`. A API importa o módulo
// para `send`; o worker, para `send` + `work`. Nenhuma lógica de domínio vive aqui.
@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private readonly boss: PgBoss;
  private started = false;

  constructor(
    @Inject(databaseConfig.KEY)
    database: ConfigType<typeof databaseConfig>,
    @Inject(queueConfig.KEY)
    queue: ConfigType<typeof queueConfig>,
  ) {
    this.boss = new PgBoss({
      host: database.host,
      port: database.port,
      user: database.username,
      password: database.password,
      database: database.name,
      schema: queue.schema,
      supervise: queue.supervise,
      migrate: true,
      max: 5,
      application_name: 'streamtube-queue',
    });
    this.boss.on('error', (error: Error) => {
      // Contexto de background: logar sem derrubar o processo (nestjs-services.md).
      this.logger.error(`pg-boss error: ${error.message}`, error.stack);
    });
  }

  async onModuleInit(): Promise<void> {
    await this.boss.start();
    this.started = true;
    for (const name of Object.values(QUEUE_NAMES)) {
      await this.ensureQueue(name);
    }
    this.logger.log(
      `Queue ready (queues: ${Object.values(QUEUE_NAMES).join(', ')})`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.started) {
      return;
    }
    await this.boss.stop({ graceful: true, timeout: 10_000, close: true });
    this.started = false;
    this.logger.log('Queue stopped (pg-boss graceful stop)');
  }

  /** Enfileira um job; devolve o id ou `null` quando a chave singleton já tem um job ativo. */
  async send<Q extends QueueName>(
    queue: Q,
    data: QueuePayloads[Q],
    options: QueueSendOptions,
  ): Promise<string | null> {
    const defaults = QUEUE_SEND_DEFAULTS[queue];
    const { db, startAfter, ...rest } = options;
    return this.boss.send(queue, data, {
      ...defaults,
      ...rest,
      // Date → ISO: evita depender de `instanceof Date` entre realms (o Jest carrega o pg-boss
      // fora da sua sandbox) e deixa o valor explícito no SQL.
      ...(startAfter !== undefined
        ? {
            startAfter:
              startAfter instanceof Date || typeof startAfter === 'object'
                ? new Date(startAfter).toISOString()
                : startAfter,
          }
        : {}),
      ...(db ? { db } : {}),
    });
  }

  /**
   * Agenda jobs recorrentes de uma fila por expressão cron, no fuso UTC. Idempotente: reagendar
   * o mesmo nome sobrescreve o agendamento (watch-page/TD-02 — limpeza diária de `video_views`).
   */
  async schedule<Q extends QueueName>(
    queue: Q,
    cron: string,
    data: QueuePayloads[Q],
  ): Promise<void> {
    await this.boss.schedule(queue, cron, data, {
      ...QUEUE_SEND_DEFAULTS[queue],
      tz: 'UTC',
    });
  }

  /** Desregistra os consumidores de uma fila (encerramento/isolamento de testes). */
  async offWork(queue: QueueName): Promise<void> {
    await this.boss.offWork(queue, { wait: true });
  }

  /** Registra o consumidor; o handler recebe um lote (`batchSize`) e, ao lançar, o lote falha. */
  async work<Q extends QueueName>(
    queue: Q,
    options: QueueWorkOptions,
    handler: QueueJobHandler<Q>,
  ): Promise<string> {
    return this.boss.work<QueuePayloads[Q]>(
      queue,
      {
        batchSize: options.batchSize ?? 1,
        pollingIntervalSeconds: options.pollingIntervalSeconds ?? 2,
      },
      async (jobs) => {
        await handler(
          jobs.map((job) => ({
            id: job.id,
            name: queue,
            data: job.data,
            retryCount: job.retryCount,
          })),
        );
      },
    );
  }

  /** Estado atual de um job (testes, reprocessamento, diagnóstico). */
  async getJob<Q extends QueueName>(queue: Q, id: string) {
    return this.boss.getJobById<QueuePayloads[Q]>(queue, id);
  }

  async hasQueue(name: QueueName): Promise<boolean> {
    return (await this.boss.getQueue(name)) !== null;
  }

  private async ensureQueue(name: QueueName): Promise<void> {
    const existing = await this.boss.getQueue(name);
    if (existing && existing.policy === QUEUE_POLICY) {
      return;
    }
    if (existing) {
      // A política é imutável; uma fila criada com outra política (ex.: ambiente antigo) é
      // recriada. Só acontece em dev/testes — em produção as filas nascem já com a política certa.
      this.logger.warn(
        `Queue "${name}" has policy "${existing.policy}", expected "${QUEUE_POLICY}" — recreating`,
      );
      await this.boss.deleteQueue(name);
    }
    await this.boss.createQueue(name, { policy: QUEUE_POLICY });
  }
}
