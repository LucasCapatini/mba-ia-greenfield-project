import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';
import { COMMENT_TEXT_MAX_LENGTH } from '../comments.constants';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** Corpo de `POST /videos/{publicId}/comments` e `POST /comments/{commentId}/replies`. */
export class CreateCommentDto {
  /** Texto puro; espaços nas pontas são removidos e as quebras de linha preservadas (1 a 2.000 caracteres). */
  @Transform(trim)
  @IsString()
  @Length(1, COMMENT_TEXT_MAX_LENGTH)
  text: string;
}

/** Corpo de `PATCH /comments/{commentId}` — mesmas regras do texto da criação (TD-07). */
export class UpdateCommentDto extends CreateCommentDto {}
