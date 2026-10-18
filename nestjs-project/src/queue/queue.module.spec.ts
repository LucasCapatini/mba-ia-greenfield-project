import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import databaseConfig from '../config/database.config';
import queueConfig from '../config/queue.config';
import { QueueModule } from './queue.module';
import { QueueService } from './queue.service';

describe('QueueModule', () => {
  it('should compile and resolve QueueService from the database and queue namespaces', async () => {
    // Sem `init()`: a compilação não abre conexão; onModuleInit só roda no bootstrap/init.
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [databaseConfig, queueConfig],
        }),
        QueueModule,
      ],
    }).compile();

    expect(module.get(QueueService)).toBeInstanceOf(QueueService);
    await module.close();
  }, 15000);
});
