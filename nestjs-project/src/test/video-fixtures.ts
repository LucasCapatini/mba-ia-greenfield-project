import { execFile } from 'node:child_process';
import { mkdir, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Fixtures de vídeo geradas pelo próprio ffmpeg da imagem (phase-03-upload-processing/TD-13):
// nada binário no repositório, 2 s de `testsrc` + tom senoidal, cacheadas em os.tmpdir() por
// processo de testes. Só suítes de integração/E2E as usam (exigem o ffmpeg do container).

export type VideoFixtureName =
  | 'mp4-h264-aac'
  | 'mp4-h264-aac-large'
  | 'mp4-h264-noaudio'
  | 'webm-vp9-opus'
  | 'mkv-hevc-aac';

interface FixtureSpec {
  file: string;
  contentType: string;
  args: string[];
}

const VIDEO_SRC = [
  '-f',
  'lavfi',
  '-i',
  'testsrc=duration=2:size=320x240:rate=25',
];
const AUDIO_SRC = ['-f', 'lavfi', '-i', 'sine=frequency=440:duration=2'];

const FIXTURES: Record<VideoFixtureName, FixtureSpec> = {
  'mp4-h264-aac': {
    file: 'h264-aac.mp4',
    contentType: 'video/mp4',
    args: [
      ...VIDEO_SRC,
      ...AUDIO_SRC,
      '-c:v',
      'libx264',
      '-preset',
      'ultrafast',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-shortest',
      '-movflags',
      '+faststart',
    ],
  },
  // ~10,8 MiB (CBR 9 Mb/s, 10 s, 720p): 3 partes com UPLOAD_PART_SIZE = 5 MiB — o fluxo multipart
  // completo sem precisar de um arquivo grande de verdade (TD-13).
  'mp4-h264-aac-large': {
    file: 'h264-aac-large.mp4',
    contentType: 'video/mp4',
    args: [
      '-f',
      'lavfi',
      '-i',
      'testsrc=duration=10:size=1280x720:rate=30',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=440:duration=10',
      '-c:v',
      'libx264',
      '-preset',
      'ultrafast',
      '-pix_fmt',
      'yuv420p',
      '-b:v',
      '9M',
      '-minrate',
      '9M',
      '-maxrate',
      '9M',
      '-bufsize',
      '1M',
      '-x264-params',
      'nal-hrd=cbr:force-cfr=1',
      '-c:a',
      'aac',
      '-shortest',
      '-movflags',
      '+faststart',
    ],
  },
  'mp4-h264-noaudio': {
    file: 'h264-noaudio.mp4',
    contentType: 'video/mp4',
    args: [
      ...VIDEO_SRC,
      '-c:v',
      'libx264',
      '-preset',
      'ultrafast',
      '-pix_fmt',
      'yuv420p',
      '-an',
      '-movflags',
      '+faststart',
    ],
  },
  'webm-vp9-opus': {
    file: 'vp9-opus.webm',
    contentType: 'video/webm',
    args: [
      ...VIDEO_SRC,
      ...AUDIO_SRC,
      '-c:v',
      'libvpx-vp9',
      '-b:v',
      '200k',
      '-deadline',
      'realtime',
      '-cpu-used',
      '8',
      '-c:a',
      'libopus',
      '-shortest',
    ],
  },
  'mkv-hevc-aac': {
    file: 'hevc-aac.mkv',
    contentType: 'video/mp4', // declarado "errado" de propósito: a validação pelos bytes é que recusa
    args: [
      ...VIDEO_SRC,
      ...AUDIO_SRC,
      '-c:v',
      'libx265',
      '-preset',
      'ultrafast',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-shortest',
    ],
  },
};

const FIXTURE_DIR = join(tmpdir(), 'streamtube-video-fixtures');

function ffmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(
      'ffmpeg',
      ['-hide_banner', '-loglevel', 'error', '-y', ...args],
      { timeout: 120_000 },
      (error, _stdout, stderr) => {
        if (error) {
          reject(
            new Error(
              `ffmpeg fixture generation failed: ${error.message}\n${String(stderr)}`,
            ),
          );
          return;
        }
        resolve();
      },
    );
  });
}

/** Caminho da fixture no disco (gera uma vez por tmpdir). */
export async function videoFixturePath(
  name: VideoFixtureName,
): Promise<string> {
  const spec = FIXTURES[name];
  const path = join(FIXTURE_DIR, spec.file);
  const exists = await stat(path)
    .then((s) => s.size > 0)
    .catch(() => false);
  if (!exists) {
    await mkdir(FIXTURE_DIR, { recursive: true });
    await ffmpeg([...spec.args, path]);
  }
  return path;
}

/** Bytes da fixture + MIME que o cliente declararia no pré-cadastro. */
export async function videoFixture(
  name: VideoFixtureName,
): Promise<{ buffer: Buffer; contentType: string }> {
  const path = await videoFixturePath(name);
  return {
    buffer: await readFile(path),
    contentType: FIXTURES[name].contentType,
  };
}
