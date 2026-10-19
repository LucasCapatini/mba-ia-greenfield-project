import {
  attachmentDisposition,
  sanitizeFilename,
} from './content-disposition.util';

describe('content-disposition.util', () => {
  describe('sanitizeFilename', () => {
    it('should keep an ordinary name with spaces', () => {
      expect(sanitizeFilename('meu video.mp4', 'video/mp4')).toBe(
        'meu video.mp4',
      );
    });

    it('should strip quotes, backslashes, slashes, CR/LF and control characters', () => {
      expect(sanitizeFilename('a"b\\c/d\r\ne\x00f.mp4', 'video/mp4')).toBe(
        'abcdef.mp4',
      );
    });

    it('should collapse whitespace and trim', () => {
      expect(sanitizeFilename('  a \t  b.webm  ', 'video/webm')).toBe(
        'a b.webm',
      );
    });

    it('should limit the length to 200 characters', () => {
      expect(sanitizeFilename('x'.repeat(300), 'video/mp4')).toHaveLength(200);
    });

    it.each([
      ['', 'video/mp4', 'video.mp4'],
      ['"\r\n"', 'video/webm', 'video.webm'],
      ['..', 'video/mp4', 'video.mp4'],
      ['', 'application/octet-stream', 'video.bin'],
    ])(
      'should fall back to video.<ext> for %p (%s)',
      (input, contentType, expected) => {
        expect(sanitizeFilename(input, contentType)).toBe(expected);
      },
    );
  });

  describe('attachmentDisposition', () => {
    it('should produce a plain quoted filename for ASCII names', () => {
      expect(attachmentDisposition('meu video.mp4', 'video/mp4')).toBe(
        'attachment; filename="meu video.mp4"',
      );
    });

    it('should add an RFC 5987 filename* when the name has non-ASCII characters', () => {
      expect(attachmentDisposition('vídeo.mp4', 'video/mp4')).toBe(
        `attachment; filename="v_deo.mp4"; filename*=UTF-8''v%C3%ADdeo.mp4`,
      );
    });

    it('should never contain CR/LF or double quotes inside the quoted value', () => {
      const header = attachmentDisposition(
        'evil"\r\nSet-Cookie: x.mp4',
        'video/mp4',
      );
      expect(header).toBe('attachment; filename="evilSet-Cookie: x.mp4"');
    });
  });
});
