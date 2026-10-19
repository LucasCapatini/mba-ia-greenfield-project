import { Injectable } from '@nestjs/common';
import { DataSource, QueryFailedError } from 'typeorm';
import { Video } from '../videos/entities/video.entity';
import {
  ChannelNotFoundException,
  NicknameTakenException,
} from './channels.exceptions';
import type {
  ChannelPublicResponse,
  ChannelResponse,
} from './dto/channel-response.dto';
import type { UpdateChannelDto } from './dto/update-channel.dto';
import {
  appendRandomSuffix,
  isUsableNickname,
  sanitizeNickname,
} from './nickname.util';
import { Channel } from './entities/channel.entity';

const PG_UNIQUE_VIOLATION = '23505';
const NICKNAME_COLUMN = 'nickname';
const MAX_RETRIES = 5;

function isPgUniqueViolationOnColumn(err: unknown, column: string): boolean {
  if (!(err instanceof QueryFailedError)) return false;
  const e = err as unknown as { code?: string; detail?: string };
  return (
    e.code === PG_UNIQUE_VIOLATION &&
    typeof e.detail === 'string' &&
    e.detail.includes(column)
  );
}

@Injectable()
export class ChannelsService {
  constructor(private readonly dataSource: DataSource) {}

  /** Canal do usuário (1:1, criado no cadastro — Fase 02); `null` se o invariante foi violado. */
  async findByUserId(userId: string): Promise<Channel | null> {
    return this.dataSource
      .getRepository(Channel)
      .findOne({ where: { user_id: userId } });
  }

  /** Leitura pública por nickname; `null` quando não existe. */
  async findByNickname(nickname: string): Promise<Channel | null> {
    return this.dataSource
      .getRepository(Channel)
      .findOne({ where: { nickname } });
  }

  /**
   * Vídeos visíveis na página pública: `published` + `public` (video-channel-management/TD-02).
   * Rascunhos e `unlisted` não contam.
   */
  async countPublicVideos(channelId: string): Promise<number> {
    return this.dataSource.getRepository(Video).count({
      where: {
        channel_id: channelId,
        status: 'published',
        visibility: 'public',
      },
    });
  }

  /** `GET /channels/me` — o canal do usuário autenticado com a contagem pública. */
  async getOwnChannel(userId: string): Promise<ChannelResponse> {
    return this.toResponse(await this.requireOwnChannel(userId));
  }

  /** `GET /channels/{nickname}` — leitura pública, sem id nem dados do usuário. */
  async getPublicChannel(nickname: string): Promise<ChannelPublicResponse> {
    const channel = await this.findByNickname(nickname);
    if (!channel) {
      throw new ChannelNotFoundException();
    }
    return {
      nickname: channel.nickname,
      name: channel.name,
      description: channel.description,
      video_count: await this.countPublicVideos(channel.id),
      created_at: channel.created_at.toISOString(),
    };
  }

  /**
   * Edição parcial do próprio canal (TD-08). O nickname novo é pré-checado contra os outros
   * canais e, numa corrida entre a checagem e a escrita, a unique violation (`23505`) também vira
   * 409 `NICKNAME_TAKEN`. O nickname antigo fica livre na hora (sem redirecionamento).
   */
  async updateChannel(
    userId: string,
    dto: UpdateChannelDto,
  ): Promise<ChannelResponse> {
    const channel = await this.requireOwnChannel(userId);
    const changes: Partial<Pick<Channel, 'nickname' | 'name' | 'description'>> =
      {};
    if (dto.nickname !== undefined && dto.nickname !== channel.nickname) {
      const holder = await this.findByNickname(dto.nickname);
      if (holder && holder.id !== channel.id) {
        throw new NicknameTakenException(dto.nickname);
      }
      changes.nickname = dto.nickname;
    }
    if (dto.name !== undefined) changes.name = dto.name;
    if (dto.description !== undefined) changes.description = dto.description;

    const repository = this.dataSource.getRepository(Channel);
    if (Object.keys(changes).length > 0) {
      try {
        await repository.update(channel.id, changes);
      } catch (err) {
        if (isPgUniqueViolationOnColumn(err, NICKNAME_COLUMN)) {
          throw new NicknameTakenException(changes.nickname ?? dto.nickname!);
        }
        throw err;
      }
    }
    return this.toResponse(
      await repository.findOneByOrFail({ id: channel.id }),
    );
  }

  private async requireOwnChannel(userId: string): Promise<Channel> {
    const channel = await this.findByUserId(userId);
    if (!channel) {
      // Invariante da Fase 02 (canal criado no cadastro) violado.
      throw new ChannelNotFoundException();
    }
    return channel;
  }

  private async toResponse(channel: Channel): Promise<ChannelResponse> {
    return {
      id: channel.id,
      nickname: channel.nickname,
      name: channel.name,
      description: channel.description,
      video_count: await this.countPublicVideos(channel.id),
      created_at: channel.created_at.toISOString(),
      updated_at: channel.updated_at.toISOString(),
    };
  }

  async createChannel(userId: string, email: string): Promise<Channel> {
    const baseNickname = sanitizeNickname(email.split('@')[0]);

    return this.dataSource.transaction(async (manager) => {
      // Prefixo reservado ou com menos de 3 caracteres: o primeiro candidato já leva sufixo.
      let nickname = isUsableNickname(baseNickname)
        ? baseNickname
        : appendRandomSuffix(baseNickname);

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        const existing = await manager.findOne(Channel, {
          where: { nickname },
        });
        if (existing) {
          nickname = appendRandomSuffix(baseNickname);
          continue;
        }

        try {
          return await manager.save(
            manager.create(Channel, {
              name: baseNickname,
              nickname,
              user_id: userId,
            }),
          );
        } catch (err) {
          if (isPgUniqueViolationOnColumn(err, NICKNAME_COLUMN)) {
            // Concurrent insert between pre-check and save — retry with new suffix
            nickname = appendRandomSuffix(baseNickname);
          } else {
            throw err;
          }
        }
      }

      throw new Error(
        'Nickname conflict could not be resolved after max retries',
      );
    });
  }
}
