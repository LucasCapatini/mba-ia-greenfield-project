import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ALL_ENTITIES,
  createTestDataSource,
} from '../test/create-test-data-source';
import { CommentReactionsController } from './comment-reactions.controller';
import { CommentReactionsService } from './comment-reactions.service';
import { ReactionsModule } from './reactions.module';
import { VideoReactionsController } from './video-reactions.controller';
import { VideoReactionsService } from './video-reactions.service';

describe('ReactionsModule', () => {
  it('should compile with its repositories, both services and both controllers', async () => {
    const module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot(createTestDataSource(ALL_ENTITIES).options),
        ReactionsModule,
      ],
    }).compile();

    expect(module.get(VideoReactionsService)).toBeInstanceOf(
      VideoReactionsService,
    );
    expect(module.get(VideoReactionsController)).toBeInstanceOf(
      VideoReactionsController,
    );
    expect(module.get(CommentReactionsService)).toBeInstanceOf(
      CommentReactionsService,
    );
    expect(module.get(CommentReactionsController)).toBeInstanceOf(
      CommentReactionsController,
    );
    await module.close();
  }, 30000);
});
