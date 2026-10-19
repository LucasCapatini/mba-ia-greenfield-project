import type { ProbeResult } from './ffmpeg.service';
import { normalizeContainer, validateProbe } from './video-format.validator';
import { UnsupportedFormatError } from './worker.errors';

function probe(overrides: Partial<ProbeResult> = {}): ProbeResult {
  return {
    formatName: 'mov,mp4,m4a,3gp,3g2,mj2',
    durationSeconds: 2,
    videoStream: { codec: 'h264', width: 320, height: 240 },
    audioStream: { codec: 'aac' },
    ...overrides,
  };
}

describe('video-format.validator', () => {
  describe('normalizeContainer', () => {
    it.each([
      ['mov,mp4,m4a,3gp,3g2,mj2', 'mp4'],
      ['mp4', 'mp4'],
      ['matroska,webm', 'webm'],
      ['webm', 'webm'],
      ['MATROSKA,WEBM', 'webm'],
      ['avi', null],
      ['', null],
    ])('should map ffprobe format_name %p to %p', (formatName, expected) => {
      expect(normalizeContainer(formatName)).toBe(expected);
    });
  });

  describe('validateProbe', () => {
    it('should accept mp4 / h264 / aac', () => {
      expect(validateProbe(probe())).toEqual({
        container: 'mp4',
        videoCodec: 'h264',
        audioCodec: 'aac',
      });
    });

    it('should accept webm / vp9 / opus', () => {
      expect(
        validateProbe(
          probe({
            formatName: 'matroska,webm',
            videoStream: { codec: 'vp9', width: 640, height: 360 },
            audioStream: { codec: 'opus' },
          }),
        ),
      ).toEqual({ container: 'webm', videoCodec: 'vp9', audioCodec: 'opus' });
    });

    it('should accept a video without an audio stream (audioCodec null)', () => {
      expect(validateProbe(probe({ audioStream: undefined }))).toEqual({
        container: 'mp4',
        videoCodec: 'h264',
        audioCodec: null,
      });
    });

    it('should normalize codec names case-insensitively', () => {
      expect(
        validateProbe(
          probe({
            videoStream: { codec: 'H264', width: 1, height: 1 },
            audioStream: { codec: 'AAC' },
          }),
        ),
      ).toMatchObject({ videoCodec: 'h264', audioCodec: 'aac' });
    });

    it.each([
      ['an unknown container', probe({ formatName: 'avi' }), /container "avi"/],
      [
        'an mp4 without a video stream',
        probe({ videoStream: undefined }),
        /no video stream/,
      ],
      [
        'hevc video',
        probe({ videoStream: { codec: 'hevc', width: 1, height: 1 } }),
        /video codec "hevc"/,
      ],
      [
        'ac3 audio',
        probe({ audioStream: { codec: 'ac3' } }),
        /audio codec "ac3"/,
      ],
    ])(
      'should reject %s with UnsupportedFormatError and a detail',
      (_label, input, detail) => {
        expect(() => validateProbe(input)).toThrow(UnsupportedFormatError);
        expect(() => validateProbe(input)).toThrow(detail);
      },
    );
  });
});
