import { ApiProperty } from '@nestjs/swagger';
import type { CursorPage } from '../../common/pagination/cursor-page.dto';
import {
  REACTION_VALUES,
  type ReactionValue,
} from '../../reactions/reactions.constants';
import { VideoCardChannel } from '../../videos/dto/video-response.dto';

/** Comentário (raiz ou resposta) com o estado do espectador (social-interactions/TD-04, TD-06). */
export class CommentResponse {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description:
      'null na raiz; nas respostas, o id da raiz (um nível só — TD-05).',
  })
  parent_id: string | null;

  @ApiProperty({
    description: 'Texto puro; quebras de linha preservadas.',
    example: 'Ótimo vídeo',
  })
  text: string;

  @ApiProperty({
    type: VideoCardChannel,
    description: 'Canal do autor (nickname e nome públicos).',
  })
  author: VideoCardChannel;

  @ApiProperty({ description: 'ISO-8601' })
  created_at: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'ISO-8601 da última edição; null se nunca editado.',
  })
  edited_at: string | null;

  @ApiProperty({ type: 'integer', example: 0 })
  like_count: number;

  @ApiProperty({ type: 'integer', example: 0 })
  dislike_count: number;

  @ApiProperty({
    type: 'integer',
    example: 0,
    description: 'Respostas da raiz; sempre 0 nas respostas.',
  })
  reply_count: number;

  @ApiProperty({
    enum: REACTION_VALUES,
    nullable: true,
    description: 'Reação do solicitante ao comentário; anônimo → null.',
  })
  viewer_reaction: ReactionValue | null;

  @ApiProperty({
    description:
      'Se o solicitante é o autor (mostra o menu Editar/Excluir); anônimo → false.',
  })
  viewer_is_author: boolean;
}

export class CommentsPage implements CursorPage<CommentResponse> {
  @ApiProperty({ type: [CommentResponse] })
  items: CommentResponse[];

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Cursor da próxima página; null na última.',
  })
  next_cursor: string | null;
}
