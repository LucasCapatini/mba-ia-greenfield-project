import { Module } from '@nestjs/common';
import { QueueService } from './queue.service';

// Importado explicitamente por quem precisa (VideosModule: send; WorkerModule: send + work).
// Depende do ConfigModule global (namespaces `database` e `queue`).
@Module({
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}
