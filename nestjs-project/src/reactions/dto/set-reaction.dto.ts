import { IsIn } from 'class-validator';
import { REACTION_VALUES, type ReactionValue } from '../reactions.constants';

/** Corpo de `PUT …/reaction` em vídeos e comentários (social-interactions/TD-03). */
export class SetReactionDto {
  /** Reação desejada: `like` ou `dislike`. */
  @IsIn(REACTION_VALUES)
  value: ReactionValue;
}
