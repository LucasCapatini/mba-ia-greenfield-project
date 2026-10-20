import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommentReactionsService } from '../reactions/comment-reactions.service';
import {
  ALL_ENTITIES,
  createTestDataSource,
} from '../test/create-test-data-source';
import { CommentsController } from './comments.controller';
import { CommentsModule } from './comments.module';
import { CommentsService } from './comments.service';
import { VideoCommentsController } from './video-comments.controller';

describe('CommentsModule', () => {
  it('should compile with its repositories, the reactions read and both controllers', async () => {
    const module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot(createTestDataSource(ALL_ENTITIES).options),
        CommentsModule,
      ],
    }).compile();

    expect(module.get(CommentsService)).toBeInstanceOf(CommentsService);
    expect(module.get(CommentReactionsService)).toBeInstanceOf(
      CommentReactionsService,
    );
    expect(module.get(VideoCommentsController)).toBeInstanceOf(
      VideoCommentsController,
    );
    expect(module.get(CommentsController)).toBeInstanceOf(CommentsController);
    await module.close();
  }, 30000);
});
