import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

  /** Carrega o vídeo (com a sessão de upload) e garante que `userId` é o dono. */
  async loadOwned(userId: string, publicId: string): Promise<Video> {
    const video = await this.videoRepository.findOne({
      where: { public_id: publicId },
      relations: ['upload'],
    });
    if (!video) {
      throw new VideoNotFoundException();
    }
    const channel = await this.channelsService.findByUserId(userId);
    if (!channel || channel.id !== video.channel_id) {
      throw new VideoForbiddenException();
    }
    return video;
  }
}
