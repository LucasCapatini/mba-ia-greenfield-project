import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Channel } from '../channels/entities/channel.entity';
import { ChannelSubscriptionController } from './channel-subscription.controller';
import { Subscription } from './entities/subscription.entity';
import { MeSubscriptionsController } from './me-subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';

// Inscrições em canais (social-interactions/TD-03, TD-08). Lê `Channel` pelo próprio repositório
// em vez de importar o ChannelsModule: ChannelsModule/VideosModule importam este módulo para o
// `viewer_subscribed` das leituras (TD-04), então a dependência só pode ir num sentido.
@Module({
  imports: [TypeOrmModule.forFeature([Subscription, Channel])],
  controllers: [ChannelSubscriptionController, MeSubscriptionsController],
  providers: [SubscriptionsService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
