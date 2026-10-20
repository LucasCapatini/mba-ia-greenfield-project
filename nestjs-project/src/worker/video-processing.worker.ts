import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Repository } from 'typeorm';
import { QUEUE_NAMES, QUEUE_SEND_DEFAULTS } from '../queue/queue.constants';
import { type QueueJob, QueueService } from '../queue/queue.service';
import { StorageService } from '../storage/storage.service';
import { Video } from '../videos/entities/video.entity';
import { storageKeys } from '../videos/public-id.util';
import type { VideoProcessingError } from '../videos/videos.constants';
import { FfmpegService, type ProbeResult } from './ffmpeg.service';
import { type ValidatedFormat, validateProbe } from './video-format.validator';
import {
  PROCESSING_URL_TTL_SECONDS,
  THUMBNAIL,
  VIDEO_PROCESS_WORK_OPTIONS,
} from './worker.constants';
import { UnsupportedFormatError, truncateDetail } from './worker.errors';

type VideoProcessJob = QueueJob<typeof QUEUE_NAMES.VIDEO_PROCESS>;

/** Erros destas etapas são transitórios: relançados para o retry do pg-boss (TD-11). */
type RetryableStage = 'PROBE_FAILED' | 'THUMBNAIL_FAILED';

class StageError extends Error {
  constructor(
    readonly stage: RetryableStage,
    readonly cause: unknown,
  ) {
    super(`${stage}: ${describe(cause)}`);
    this.name = 'StageError';
  }
}

function describe(err: unknown): string {
  if (err && typeof err === 'object' && 'detail' in err) {
    return String((err as { detail: unknown }).detail);
  }
  return err instanceof Error ? `${err.name}: ${err.message}` : String(err);
}

// Consumidor de `video.process` (phase-03-videos/TD-06, TD-11, TD-14): lê o vídeo por
// URL interna assinada (sem download), valida a allowlist pelos bytes, extrai metadados e thumbnail
// e conclui por transições guardadas (`WHERE processing_status = 'processing'`), idempotentes em
// entregas repetidas. Contexto de background: o handler loga; só relança o que deve ser retentado.
@Injectable()
export class VideoProcessingWorker implements OnModuleInit {
  private readonly logger = new Logger(VideoProcessingWorker.name);
  private readonly retryLimit =
    QUEUE_SEND_DEFAULTS[QUEUE_NAMES.VIDEO_PROCESS].retryLimit;

  constructor(
    @InjectRepository(Video)
    private readonly videoRepository: Repository<Video>,
    private readonly queue: QueueService,
    private readonly storage: StorageService,
    private readonly ffmpeg: FfmpegService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.queue.work(
      QUEUE_NAMES.VIDEO_PROCESS,
      VIDEO_PROCESS_WORK_OPTIONS,
      async (jobs) => {
        for (const job of jobs) {
          await this.handle(job);
        }
      },
    );
    this.logger.log(`Listening on ${QUEUE_NAMES.VIDEO_PROCESS}`);
  }

  /** Processa um job; lança apenas quando o pg-boss deve retentar. */
  async handle(job: VideoProcessJob): Promise<void> {
    const { videoId } = job.data;
    const attempt = job.retryCount + 1;
    const startedAt = Date.now();
    const tag = `[video ${videoId}, job ${job.id}, attempt ${attempt}/${this.retryLimit + 1}]`;

    const video = await this.videoRepository.findOneBy({ id: videoId });
    if (!video) {
      this.logger.warn(`${tag} video not found — skipping`);
      return;
    }
    if (video.processing_status !== 'processing') {
      this.logger.log(`${tag} already ${video.processing_status} — no-op`);
      return;
    }

    try {
      await this.process(video, tag);
      this.logger.log(`${tag} ready in ${Date.now() - startedAt} ms`);
    } catch (err) {
      if (err instanceof UnsupportedFormatError) {
        // Determinístico: retentar não muda os bytes (TD-14).
        await this.markFailed(video, 'UNSUPPORTED_FORMAT', err.detail);
        this.logger.warn(`${tag} unsupported format: ${err.detail}`);
        return;
      }
      if (err instanceof StageError) {
        if (job.retryCount >= this.retryLimit) {
          await this.markFailed(video, err.stage, describe(err.cause));
          this.logger.error(
            `${tag} ${err.stage} after last attempt: ${describe(err.cause)}`,
          );
          return;
        }
        this.logger.warn(
          `${tag} ${err.stage}, will retry: ${describe(err.cause)}`,
        );
        throw err.cause;
      }
      throw err;
    }
  }

  private async process(video: Video, tag: string): Promise<void> {
    const head = await this.storage.headObject(video.storage_key);
    if (!head) {
      // Sem objeto não há o que retentar: o complete nunca aconteceu ou o storage perdeu o dado.
      await this.markFailed(
        video,
        'OBJECT_MISSING',
        `object ${video.storage_key} not found`,
      );
      this.logger.error(`${tag} object missing: ${video.storage_key}`);
      return;
    }

    let probe: ProbeResult | undefined;
    let format: ValidatedFormat | undefined;
    try {
      const url = await this.storage.presignGetObject(
        video.storage_key,
        PROCESSING_URL_TTL_SECONDS,
        { public: false },
      );
      probe = await this.ffmpeg.probe(url);
      format = validateProbe(probe);
      await this.uploadThumbnail(video, url, probe.durationSeconds);
    } catch (err) {
      if (err instanceof UnsupportedFormatError) {
        throw err;
      }
      throw new StageError(probe ? 'THUMBNAIL_FAILED' : 'PROBE_FAILED', err);
    }
    if (!probe?.videoStream || !format) {
      throw new Error('unreachable: probe and format are set after the try');
    }

    const thumbnailKey = storageKeys(video.public_id).thumbnail;
    const updated = await this.videoRepository.update(
      { id: video.id, processing_status: 'processing' },
      {
        processing_status: 'ready',
        processing_error: null,
        processing_error_detail: null,
        duration_seconds: probe.durationSeconds,
        width: probe.videoStream.width,
        height: probe.videoStream.height,
        container: format.container,
        video_codec: format.videoCodec,
        audio_codec: format.audioCodec,
        thumbnail_key: thumbnailKey,
        processed_at: new Date(),
      },
    );
    if (!updated.affected) {
      this.logger.warn(
        `${tag} state changed concurrently — ready transition skipped`,
      );
    }
  }

  /** Extrai o frame para o tmpdir, envia ao storage e remove o arquivo — sempre, mesmo em erro. */
  private async uploadThumbnail(
    video: Video,
    url: string,
    durationSeconds: number,
  ): Promise<void> {
    const at = Math.min(1, durationSeconds / 10);
    const tmpPath = join(tmpdir(), `streamtube-thumb-${video.id}.jpg`);
    try {
      await this.ffmpeg.extractFrame(url, at, tmpPath);
      const jpeg = await readFile(tmpPath);
      await this.storage.putObject(
        storageKeys(video.public_id).thumbnail,
        jpeg,
        THUMBNAIL.contentType,
      );
    } finally {
      await rm(tmpPath, { force: true });
    }
  }

  private async markFailed(
    video: Video,
    code: VideoProcessingError,
    detail: string,
  ): Promise<void> {
    await this.videoRepository.update(
      { id: video.id, processing_status: 'processing' },
      {
        processing_status: 'failed',
        processing_error: code,
        processing_error_detail: truncateDetail(detail),
        processed_at: new Date(),
      },
    );
  }
}
