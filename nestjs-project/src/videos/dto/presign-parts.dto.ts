import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  Min,
} from 'class-validator';

// Lote de partes para as quais o cliente quer URLs pré-assinadas (POST /videos/{publicId}/upload/parts).
// O teto por parte (`part_count` da sessão) é verificado no serviço — o DTO não conhece a sessão.
export class PresignPartsDto {
  /** Números das partes (1..part_count), únicos, no máximo 100 por chamada. */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  part_numbers: number[];
}
