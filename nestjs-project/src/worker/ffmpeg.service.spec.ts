import { execFile } from 'node:child_process';
import { FfmpegService } from './ffmpeg.service';
import {
  FFMPEG_FRAME_TIMEOUT_MS,
  FFPROBE_TIMEOUT_MS,
} from './worker.constants';
import { ProbeFailedError, ThumbnailFailedError } from './worker.errors';

jest.mock('node:child_process', () => ({ execFile: jest.fn() }));

type ExecCallback = (
  error: Error | null,
  stdout: string,
  stderr: string,
) => void;
const execFileMock = execFile as unknown as jest.Mock;

function mockExec(
  impl: (
    file: string,
    args: string[],
  ) => { error?: Error; stdout?: string; stderr?: string },
) {
  execFileMock.mockImplementation(
    (file: string, args: string[], _opts: unknown, cb: ExecCallback) => {
      const r = impl(file, args);
      cb(r.error ?? null, r.stdout ?? '', r.stderr ?? '');
    },
  );
}

const URL =
  'http://rustfs:9000/bucket/videos/abc/source?X-Amz-Signature=secret';

describe('FfmpegService (execFile mocked)', () => {
  let service: FfmpegService;

  beforeEach(() => {
    execFileMock.mockReset();
    service = new FfmpegService();
  });

  describe('probe', () => {
    it('should call ffprobe with the exact JSON arguments and parse format + streams', async () => {
      mockExec(() => ({
        stdout: JSON.stringify({
          format: {
            format_name: 'mov,mp4,m4a,3gp,3g2,mj2',
            duration: '2.040000',
          },
          streams: [
            {
              codec_type: 'video',
              codec_name: 'h264',
              width: 320,
              height: 240,
            },
            { codec_type: 'audio', codec_name: 'aac' },
          ],
        }),
      }));

      const result = await service.probe(URL);

      expect(execFileMock).toHaveBeenCalledWith(
        'ffprobe',
        [
          '-v',
          'error',
          '-print_format',
          'json',
          '-show_format',
          '-show_streams',
          URL,
        ],
        expect.objectContaining({ timeout: FFPROBE_TIMEOUT_MS }),
        expect.any(Function),
      );
      expect(result).toEqual({
        formatName: 'mov,mp4,m4a,3gp,3g2,mj2',
        durationSeconds: 2.04,
        videoStream: { codec: 'h264', width: 320, height: 240 },
        audioStream: { codec: 'aac' },
      });
    });

    it('should leave audioStream undefined and fall back to the video stream duration', async () => {
      mockExec(() => ({
        stdout: JSON.stringify({
          format: { format_name: 'matroska,webm' },
          streams: [
            {
              codec_type: 'video',
              codec_name: 'vp9',
              width: 640,
              height: 360,
              duration: '3.5',
            },
          ],
        }),
      }));

      await expect(service.probe(URL)).resolves.toEqual({
        formatName: 'matroska,webm',
        durationSeconds: 3.5,
        videoStream: { codec: 'vp9', width: 640, height: 360 },
        audioStream: undefined,
      });
    });

    it('should turn a non-zero exit into ProbeFailedError carrying the stderr', async () => {
      mockExec(() => ({
        error: Object.assign(new Error('Command failed'), { code: 1 }),
        stderr: 'Invalid data found when processing input',
      }));

      const promise = service.probe(URL);

      await expect(promise).rejects.toBeInstanceOf(ProbeFailedError);
      await expect(promise).rejects.toMatchObject({
        detail: 'exit code 1: Invalid data found when processing input',
      });
    });

    it('should turn a timeout (killed by signal) into ProbeFailedError mentioning the timeout', async () => {
      mockExec(() => ({
        error: Object.assign(new Error('killed'), {
          killed: true,
          signal: 'SIGTERM',
        }),
      }));

      await expect(service.probe(URL)).rejects.toMatchObject({
        detail: `timed out after ${FFPROBE_TIMEOUT_MS} ms (SIGTERM)`,
      });
    });

    it('should reject invalid JSON output as ProbeFailedError', async () => {
      mockExec(() => ({ stdout: 'not json' }));

      await expect(service.probe(URL)).rejects.toMatchObject({
        detail: expect.stringContaining('invalid ffprobe output') as string,
      });
    });

    it('should truncate a very long stderr in the detail', async () => {
      mockExec(() => ({
        error: Object.assign(new Error('x'), { code: 1 }),
        stderr: 'e'.repeat(2000),
      }));

      const err = await service.probe(URL).catch((e: ProbeFailedError) => e);

      expect(err).toBeInstanceOf(ProbeFailedError);
      expect((err as ProbeFailedError).detail.length).toBeLessThanOrEqual(500);
      expect((err as ProbeFailedError).detail.endsWith('…')).toBe(true);
    });
  });

  describe('extractFrame', () => {
    it('should call ffmpeg with seek-before-input, one frame, 640px scale and q:v 3', async () => {
      mockExec(() => ({}));

      await service.extractFrame(URL, 0.2, '/tmp/thumb.jpg');

      expect(execFileMock).toHaveBeenCalledWith(
        'ffmpeg',
        [
          '-y',
          '-ss',
          '0.200',
          '-i',
          URL,
          '-frames:v',
          '1',
          '-vf',
          'scale=640:-2',
          '-q:v',
          '3',
          '/tmp/thumb.jpg',
        ],
        expect.objectContaining({ timeout: FFMPEG_FRAME_TIMEOUT_MS }),
        expect.any(Function),
      );
    });

    it('should turn a failure into ThumbnailFailedError with the stderr', async () => {
      mockExec(() => ({
        error: Object.assign(new Error('fail'), { code: 69 }),
        stderr: 'Output file is empty',
      }));

      const promise = service.extractFrame(URL, 1, '/tmp/thumb.jpg');

      await expect(promise).rejects.toBeInstanceOf(ThumbnailFailedError);
      await expect(promise).rejects.toMatchObject({
        detail: 'exit code 69: Output file is empty',
      });
    });
  });
});
