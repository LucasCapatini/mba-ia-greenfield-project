import { ApiProperty } from '@nestjs/swagger';

// Shapes do canal (`### API Contracts → Shapes compartilhados`). Anotados para o Swagger porque o
// openapi.json é a fonte dos tipos do frontend (openapi-docs-nestjs/TD-01).

/** Canal do próprio usuário (`GET/PATCH /channels/me`). */
export class ChannelResponse {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'tech_mastery' })
  nickname: string;

  @ApiProperty({ example: 'Tech Mastery Plus' })
  name: string;

  @ApiProperty({ type: String, nullable: true })
  description: string | null;

  @ApiProperty({
    type: 'integer',
    description: 'Vídeos `published` + `public` do canal.',
    example: 12,
  })
  video_count: number;

  @ApiProperty({ description: 'ISO-8601' })
  created_at: string;

  @ApiProperty({ description: 'ISO-8601' })
  updated_at: string;
}

/** Leitura pública por nickname (`GET /channels/{nickname}`) — sem id, usuário ou e-mail. */
export class ChannelPublicResponse {
  @ApiProperty({ example: 'tech_mastery' })
  nickname: string;

  @ApiProperty({ example: 'Tech Mastery Plus' })
  name: string;

  @ApiProperty({ type: String, nullable: true })
  description: string | null;

  @ApiProperty({
    type: 'integer',
    description: 'Vídeos `published` + `public` do canal.',
    example: 12,
  })
  video_count: number;

  @ApiProperty({ description: 'ISO-8601' })
  created_at: string;
}
