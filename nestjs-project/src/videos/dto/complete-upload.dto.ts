import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class CompletedPartDto {
  /** Número da parte (1..part_count). */
  @IsInt()
  @Min(1)
  part_number: number;

  /** ETag devolvido pelo storage no PUT da parte (com as aspas, como recebido). */
  @IsString()
  @IsNotEmpty()
  etag: string;
}

// Lista mantida pelo cliente (POST /videos/{publicId}/upload/complete) — não a de ListParts.
// Deve ter exatamente `part_count` itens; a cardinalidade (inclusive lista vazia) é verificada no
// serviço, depois da checagem de propriedade — assim um intruso recebe 403 e não 400.
export class CompleteUploadDto {
  @IsArray()
  @ArrayUnique((part: CompletedPartDto) => part.part_number)
  @ValidateNested({ each: true })
  @Type(() => CompletedPartDto)
  parts: CompletedPartDto[];
}
