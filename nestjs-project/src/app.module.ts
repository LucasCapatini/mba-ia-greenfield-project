import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CategoriesModule } from './categories/categories.module';
import { CommentsModule } from './comments/comments.module';
import {
  configModuleOptions,
  typeOrmModuleAsyncOptions,
} from './config/config-module.options';
import { ReactionsModule } from './reactions/reactions.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { VideosModule } from './videos/videos.module';

@Module({
  imports: [
    ConfigModule.forRoot(configModuleOptions),
    TypeOrmModule.forRootAsync(typeOrmModuleAsyncOptions),
    AuthModule,
    CategoriesModule,
    VideosModule,
    ReactionsModule,
    SubscriptionsModule,
    CommentsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
