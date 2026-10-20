import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ALL_ENTITIES,
  createTestDataSource,
} from '../test/create-test-data-source';
import { ChannelSubscriptionController } from './channel-subscription.controller';
import { SubscriptionsModule } from './subscriptions.module';
import { SubscriptionsService } from './subscriptions.service';

describe('SubscriptionsModule', () => {
  it('should compile with its repositories, the service and the controller', async () => {
    const module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot(createTestDataSource(ALL_ENTITIES).options),
        SubscriptionsModule,
      ],
    }).compile();

    expect(module.get(SubscriptionsService)).toBeInstanceOf(
      SubscriptionsService,
    );
    expect(module.get(ChannelSubscriptionController)).toBeInstanceOf(
      ChannelSubscriptionController,
    );
    await module.close();
  }, 30000);
});
