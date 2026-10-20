import { ApiProperty } from '@nestjs/swagger';
import { REACTION_VALUES, type ReactionValue } from '../reactions.constants';

/**
 * Estado resultante de uma mutação de reação — vídeo ou comentário (social-interactions/TD-03).
 * A UI otimista reconcilia os contadores por esta resposta (TD-09).
 */
export class ReactionStateResponse {
  @ApiProperty({
    enum: REACTION_VALUES,
    nullable: true,
    description: 'Reação do solicitante após a escrita; `null` = nenhuma.',
  })
  viewer_reaction: ReactionValue | null;

  @ApiProperty({ type: 'integer', example: 1200 })
  like_count: number;

  @ApiProperty({ type: 'integer', example: 12 })
  dislike_count: number;
}
