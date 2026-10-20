import { createHmac } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { ChannelsService } from '../channels/channels.service';
import authConfig from '../config/auth.config';
import { VideoView } from './entities/video-view.entity';
import { Video } from './entities/video.entity';

/** Who is watching: the authenticated user (if any) plus the real client IP and User-Agent. */
export interface Viewer {
  userId?: string;
  /** Visitor IP — `req.ip`, resolved from X-Forwarded-For only for the trusted BFF (TRUST_PROXY). */
  ip: string;
  userAgent: string;
}

/** UTC calendar day `YYYY-MM-DD` — the dedup bucket (watch-page/TD-02, Revisions 2026-10-19). */
export function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Registro de visualização (watch-page/TD-01, TD-02). Conta só vídeos `published`, nunca o dono do
 * canal, e no máximo uma vez por espectador e dia UTC: `INSERT … ON CONFLICT DO NOTHING` em
 * `video_views` e, só se a linha entrou, `view_count + 1` na mesma transação. O espectador anônimo
 * é um HMAC do dia + IP + User-Agent — o IP nunca é persistido em claro e a chave muda a cada dia.
 */
@Injectable()
export class VideoViewsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly channelsService: ChannelsService,
    @Inject(authConfig.KEY)
    private readonly auth: ConfigType<typeof authConfig>,
  ) {}

  /** `true` when the view was counted; `false` for drafts, the owner and same-day repeats. */
  async record(
    video: Video,
    viewer: Viewer,
    now: Date = new Date(),
  ): Promise<boolean> {
    if (video.status !== 'published') {
      return false;
    }
    if (viewer.userId && (await this.isOwner(viewer.userId, video))) {
      return false;
    }

    const windowStart = utcDay(now);
    const viewerKey = this.viewerKey(viewer, windowStart);

    return this.dataSource.transaction(async (manager) => {
      const result = await manager
        .createQueryBuilder()
        .insert()
        .into(VideoView)
        .values({
          video_id: video.id,
          viewer_key: viewerKey,
          window_start: windowStart,
        })
        .orIgnore()
        .returning(['id'])
        .execute();
      const inserted = (result.raw as unknown[]).length > 0;
      if (inserted) {
        await manager.increment(Video, { id: video.id }, 'view_count', 1);
      }
      return inserted;
    });
  }

  /** `user:{id}` for authenticated viewers; `anon:{hmac}` (salted by the UTC day) otherwise. */
  viewerKey(viewer: Viewer, windowStart: string): string {
    if (viewer.userId) {
      return `user:${viewer.userId}`;
    }
    const digest = createHmac('sha256', this.auth.jwtSecret)
      .update(`${windowStart}|${viewer.ip}|${viewer.userAgent}`)
      .digest('hex');
    return `anon:${digest}`;
  }

  private async isOwner(userId: string, video: Video): Promise<boolean> {
    const channel = await this.channelsService.findByUserId(userId);
    return channel !== null && channel.id === video.channel_id;
  }
}
