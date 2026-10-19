import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
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
import { ApiErrorEnvelope } from '../common/openapi/api-error-envelope.dto';
import { NonEmptyBodyPipe } from '../common/pipes/non-empty-body.pipe';
import { ChannelsService } from './channels.service';
import {
  ChannelPublicResponse,
  ChannelResponse,
} from './dto/channel-response.dto';
import { UpdateChannelDto } from './dto/update-channel.dto';

const errorEnvelope = { $ref: getSchemaPath(ApiErrorEnvelope) };

// Canal do usuário (leitura e edição — video-channel-management/TD-08) e página pública por
// nickname. As rotas literais `me` vêm ANTES de `:nickname` para não serem capturadas por ela;
// `me` também é nickname reservado.
@ApiTags('channels')
@Controller('channels')
export class ChannelsController {
  constructor(private readonly channelsService: ChannelsService) {}

  @Get('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Canal do usuário autenticado',
    description:
      'Nickname, nome, descrição, contagem de vídeos públicos e datas do canal do próprio usuário.',
  })
  @ApiResponse({ status: 200, description: 'Canal', type: ChannelResponse })
  @ApiResponse({
    status: 401,
    description: 'Missing or invalid access token',
    schema: errorEnvelope,
  })
  async getOwnChannel(
    @CurrentUser() user: JwtPayload,
  ): Promise<ChannelResponse> {
    return this.channelsService.getOwnChannel(user.sub);
  }

  @Patch('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Editar o próprio canal',
    description:
      'Edição parcial de nickname, name e description (ao menos um campo). O nickname é a URL pública do canal: trocá-lo libera o antigo na hora, sem redirecionamento.',
  })
  @ApiResponse({
    status: 200,
    description: 'Canal atualizado',
    type: ChannelResponse,
  })
  @ApiResponse({
    status: 400,
    description:
      'VALIDATION_ERROR — formato inválido, corpo vazio ou nickname reservado',
    schema: errorEnvelope,
  })
  @ApiResponse({
    status: 401,
    description: 'Missing or invalid access token',
    schema: errorEnvelope,
  })
  @ApiResponse({
    status: 409,
    description: 'NICKNAME_TAKEN — nickname em uso por outro canal',
    schema: errorEnvelope,
  })
  async updateOwnChannel(
    @CurrentUser() user: JwtPayload,
    @Body(NonEmptyBodyPipe) dto: UpdateChannelDto,
  ): Promise<ChannelResponse> {
    return this.channelsService.updateChannel(user.sub, dto);
  }

  @Public()
  @Get(':nickname')
  @ApiOperation({
    summary: 'Página pública do canal',
    description:
      'Nome, nickname, descrição e contagem de vídeos `published` + `public` do canal. Não exige autenticação.',
  })
  @ApiParam({
    name: 'nickname',
    description: 'Nickname do canal (sem `@`)',
    example: 'tech_mastery',
  })
  @ApiResponse({
    status: 200,
    description: 'Canal',
    type: ChannelPublicResponse,
  })
  @ApiResponse({
    status: 404,
    description: 'CHANNEL_NOT_FOUND',
    schema: errorEnvelope,
  })
  async getPublicChannel(
    @Param('nickname') nickname: string,
  ): Promise<ChannelPublicResponse> {
    return this.channelsService.getPublicChannel(nickname);
  }
}
