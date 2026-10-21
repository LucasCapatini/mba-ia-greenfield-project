import { Controller, Get, Param, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import type { JwtPayload } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { ChannelNotFoundException } from '../channels/channels.exceptions';
import { ChannelsService } from '../channels/channels.service';
import { ApiErrorEnvelope } from '../common/openapi/api-error-envelope.dto';
import {
  ListChannelVideosDto,
  ListOwnerVideosDto,
} from './dto/list-videos.dto';
import { ChannelVideosPage, OwnerVideosPage } from './dto/video-pages.dto';
import { VideosListingService } from './videos-listing.service';
import { LISTING_THROTTLE } from './videos.constants';

const errorEnvelope = { $ref: getSchemaPath(ApiErrorEnvelope) };

// Listagens de vídeos por canal (video-channel-management/TD-06). Vivem no VideosModule, com o
// prefixo `channels`, para não criar ciclo ChannelsModule ↔ VideosModule (o VideosModule já
// importa o ChannelsModule). `me/videos` vem antes de `:nickname/videos`.
@ApiTags('channels')
@Controller('channels')
export class ChannelVideosController {
  constructor(
    private readonly channelsService: ChannelsService,
    private readonly listingService: VideosListingService,
  ) {}

  @Get('me/videos')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Vídeos do próprio canal (painel)',
    description:
      'Todos os status do canal do usuário, paginados por cursor keyset. Filtros status, visibility, processing_status, from/to (data de criação), busca q no título e ordenação latest|oldest|views; total conta os filtros sem o cursor.',
  })
  @ApiResponse({
    status: 200,
    description: 'Página de vídeos',
    type: OwnerVideosPage,
  })
  @ApiResponse({
    status: 400,
    description:
      'VALIDATION_ERROR — parâmetro fora do domínio, from > to ou cursor inválido',
    schema: errorEnvelope,
  })
  @ApiResponse({
    status: 401,
    description: 'Missing or invalid access token',
    schema: errorEnvelope,
  })
  async listOwnVideos(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListOwnerVideosDto,
  ): Promise<OwnerVideosPage> {
    const channel = await this.channelsService.findByUserId(user.sub);
    if (!channel) {
      throw new ChannelNotFoundException();
    }
    return this.listingService.listOwnerVideos(channel.id, query);
  }

  @Public()
  @Get(':nickname/videos')
  @Throttle(LISTING_THROTTLE)
  @ApiOperation({
    summary: 'Vídeos públicos do canal',
    description:
      'Só vídeos published + public, paginados por cursor keyset; ordenação latest|popular|oldest. Não exige autenticação.',
  })
  @ApiParam({
    name: 'nickname',
    description: 'Nickname do canal (sem `@`)',
    example: 'tech_mastery',
  })
  @ApiResponse({
    status: 200,
    description: 'Página de vídeos',
    type: ChannelVideosPage,
  })
  @ApiResponse({
    status: 400,
    description:
      'VALIDATION_ERROR — parâmetro fora do domínio ou cursor inválido',
    schema: errorEnvelope,
  })
  @ApiResponse({
    status: 404,
    description: 'CHANNEL_NOT_FOUND',
    schema: errorEnvelope,
  })
  @ApiResponse({
    status: 429,
    description:
      'Too Many Requests — limite de 60 req/min por visitante (scroll infinito)',
  })
  async listChannelVideos(
    @Param('nickname') nickname: string,
    @Query() query: ListChannelVideosDto,
  ): Promise<ChannelVideosPage> {
    const channel = await this.channelsService.findByNickname(nickname);
    if (!channel) {
      throw new ChannelNotFoundException();
    }
    return this.listingService.listChannelPublicVideos(channel, query);
  }
}
