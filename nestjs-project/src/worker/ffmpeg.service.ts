import { Injectable, Logger } from '@nestjs/common';
import { execFile } from 'node:child_process';
import {
  FFMPEG_FRAME_TIMEOUT_MS,
  FFPROBE_TIMEOUT_MS,
  THUMBNAIL,
} from './worker.constants';
import { ProbeFailedError, ThumbnailFailedError } from './worker.errors';

export interface ProbeVideoStream {
  codec: string;
  width: number;
  height: number;
}

export interface ProbeAudioStream {
  codec: string;
}

export interface ProbeResult {
  /** `format.format_name` cru do ffprobe (pode ser composto: `mov,mp4,m4a,3gp,3g2,mj2`). */
  formatName: string;
  durationSeconds: number;
  videoStream?: ProbeVideoStream;
  audioStream?: ProbeAudioStream;
}

interface FfprobeJson {
  format?: { format_name?: string; duration?: string };
  streams?: Array<{
    codec_type?: string;
    codec_name?: string;
    width?: number;
    height?: number;
    duration?: string;
  }>;
}

interface ExecResult {
  stdout: string;
  stderr: string;
}

const MAX_BUFFER = 8 * 1024 * 1024;

// Fachada sobre os binários `ffprobe`/`ffmpeg` do apt via `execFile` (phase-03-upload-processing/
// TD-06): sem wrapper npm (fluent-ffmpeg está deprecado), sem shell (argumentos como array), e a
// entrada é sempre uma URL assinada — o vídeo nunca é baixado para o disco do worker.
@Injectable()
export class FfmpegService {
  private readonly logger = new Logger(FfmpegService.name);

  /** Metadados do container e dos streams; lança `ProbeFailedError` em timeout/saída ≠ 0/JSON inválido. */
  async probe(url: string): Promise<ProbeResult> {
    const args = [
      '-v',
      'error',
      '-print_format',
      'json',
      '-show_format',
      '-show_streams',
      url,
    ];
    let result: ExecResult;
    try {
      result = await this.exec('ffprobe', args, FFPROBE_TIMEOUT_MS);
    } catch (err) {
      throw new ProbeFailedError(describeExecError(err));
    }
    let json: FfprobeJson;
    try {
      json = JSON.parse(result.stdout) as FfprobeJson;
    } catch {
      throw new ProbeFailedError(`invalid ffprobe output: ${result.stdout}`);
    }
    const video = json.streams?.find((s) => s.codec_type === 'video');
    const audio = json.streams?.find((s) => s.codec_type === 'audio');
    const duration = Number(json.format?.duration ?? video?.duration ?? NaN);
    return {
      formatName: json.format?.format_name ?? '',
      durationSeconds: Number.isFinite(duration) ? duration : 0,
      videoStream: video?.codec_name
        ? {
            codec: video.codec_name,
            width: video.width ?? 0,
            height: video.height ?? 0,
          }
        : undefined,
      audioStream: audio?.codec_name ? { codec: audio.codec_name } : undefined,
    };
  }

  /** Um frame JPEG (largura `THUMBNAIL.width`) no instante `atSeconds`, gravado em `outPath`. */
  async extractFrame(
    url: string,
    atSeconds: number,
    outPath: string,
  ): Promise<void> {
    const args = [
      '-y',
      '-ss',
      atSeconds.toFixed(3),
      '-i',
      url,
      '-frames:v',
      '1',
      '-vf',
      `scale=${THUMBNAIL.width}:-2`,
      '-q:v',
      String(THUMBNAIL.quality),
      outPath,
    ];
    try {
      await this.exec('ffmpeg', args, FFMPEG_FRAME_TIMEOUT_MS);
    } catch (err) {
      throw new ThumbnailFailedError(describeExecError(err));
    }
  }

  private exec(
    file: string,
    args: string[],
    timeoutMs: number,
  ): Promise<ExecResult> {
    this.logger.debug(`${file} ${args.map(redactUrl).join(' ')}`);
    return new Promise((resolve, reject) => {
      execFile(
        file,
        args,
        { timeout: timeoutMs, maxBuffer: MAX_BUFFER, windowsHide: true },
        (error, stdout, stderr) => {
          if (error) {
            // Novo Error com as props do ExecFileException (code, killed, signal) + contexto.
            reject(
              Object.assign(new Error(error.message), error, {
                stderr: String(stderr),
                timeoutMs,
              }),
            );
            return;
          }
          resolve({ stdout: String(stdout), stderr: String(stderr) });
        },
      );
    });
  }
}

function describeExecError(err: unknown): string {
  const e = err as {
    code?: number | string;
    killed?: boolean;
    signal?: string;
    stderr?: string;
    message?: string;
    timeoutMs?: number;
  };
  if (e.killed && e.signal) {
    return `timed out after ${e.timeoutMs ?? '?'} ms (${e.signal})`;
  }
  const stderr = e.stderr?.trim();
  if (stderr) {
    return `exit code ${String(e.code)}: ${stderr}`;
  }
  return e.message ?? String(err);
}

/** Esconde a assinatura das URLs nos logs. */
function redactUrl(arg: string): string {
  return arg.startsWith('http') ? arg.replace(/\?.*$/, '?<signed>') : arg;
}
