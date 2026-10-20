import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { JwtPayload } from '../auth/auth.types';
import { ChannelsService } from '../channels/channels.service';
import { Video } from './entities/video.entity';
import {
  VideoForbiddenException,
  VideoNotFoundException,
} from './videos.exceptions';

// Regra de propriedade dos endpoints `/videos/{publicId}/**` (`### Authorization Matrix`,
// AMB-1 → TD-09): nesta fase todo vídeo é rascunho privado — só o dono do canal o acessa.
// 404 quando o `public_id` não existe; 403 quando o usuário autenticado não é o dono.
@Injectable()
export class VideosOwnership {
  constructor(
    @InjectRepository(Video)
    private readonly videoRepository: Repository<Video>,
    private readonly channelsService: ChannelsService,
  ) {}

  /** Carrega o vídeo (com a sessão de upload, a categoria e o canal) e garante que `userId` é o dono. */
  async loadOwned(userId: string, publicId: string): Promise<Video> {
    const video = await this.findByPublicId(publicId);
    if (!(await this.isOwner(userId, video))) {
      throw new VideoForbiddenException();
    }
    return video;
  }

  /**
   * Regra de leitura das rotas públicas com auth opcional (video-channel-management/TD-07, TD-02):
   * vídeo `published` (public ou unlisted — a leitura é por `public_id`) é visível a todos; outro
   * status só ao dono. Rascunho alheio responde 404 como se não existisse, nunca 403.
   */
  async loadReadable(
    user: JwtPayload | undefined,
    publicId: string,
  ): Promise<Video> {
    const video = await this.findByPublicId(publicId);
    if (video.status === 'published') {
      return video;
    }
    if (user && (await this.isOwner(user.sub, video))) {
      return video;
    }
    throw new VideoNotFoundException();
  }

  private async findByPublicId(publicId: string): Promise<Video> {
    const video = await this.videoRepository.findOne({
      where: { public_id: publicId },
      relations: ['upload', 'category', 'channel'],
    });
    if (!video) {
      throw new VideoNotFoundException();
    }
    return video;
  }

  private async isOwner(userId: string, video: Video): Promise<boolean> {
    const channel = await this.channelsService.findByUserId(userId);
    return channel !== null && channel.id === video.channel_id;
  }
}
