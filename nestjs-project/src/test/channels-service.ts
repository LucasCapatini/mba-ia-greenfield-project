import type { DataSource } from 'typeorm';
import { Channel } from '../channels/entities/channel.entity';
import { ChannelsService } from '../channels/channels.service';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

/**
 * Serviços reais sobre o `DataSource` de teste, para suítes de integração que os montam sem o
 * container do Nest. Desde a Fase 06 o `ChannelsService` depende do `SubscriptionsService`
 * (`viewer_subscribed` da leitura pública — social-interactions/TD-04).
 */
export function createSubscriptionsService(
  dataSource: DataSource,
): SubscriptionsService {
  return new SubscriptionsService(
    dataSource,
    dataSource.getRepository(Channel),
    dataSource.getRepository(Subscription),
  );
}

export function createChannelsService(dataSource: DataSource): ChannelsService {
  return new ChannelsService(
    dataSource,
    createSubscriptionsService(dataSource),
  );
}
