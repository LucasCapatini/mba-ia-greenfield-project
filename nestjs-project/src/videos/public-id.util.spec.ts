import {
  PUBLIC_ID_LENGTH,
  PUBLIC_ID_PATTERN,
  generatePublicId,
  isValidPublicId,
  storageKeys,
} from './public-id.util';

describe('generatePublicId', () => {
  it('should return 11 characters from the URL-safe alphabet [A-Za-z0-9_-]', () => {
    for (let i = 0; i < 1000; i++) {
      const id = generatePublicId();
      expect(id).toHaveLength(PUBLIC_ID_LENGTH);
      expect(id).toMatch(PUBLIC_ID_PATTERN);
    }
  });

  it('should never contain base64 padding or non-URL-safe characters', () => {
    for (let i = 0; i < 1000; i++) {
      const id = generatePublicId();
      expect(id).not.toMatch(/[+/=]/);
    }
  });

  it('should produce no collision across 10 000 generations', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 10_000; i++) {
      seen.add(generatePublicId());
    }
    expect(seen.size).toBe(10_000);
  });
});

describe('isValidPublicId', () => {
  it('should accept a well-formed id and reject wrong length or alphabet', () => {
    expect(isValidPublicId('dQw4w9WgXcQ')).toBe(true);
    expect(isValidPublicId('abc')).toBe(false);
    expect(isValidPublicId('dQw4w9WgXc+')).toBe(false);
    expect(isValidPublicId('dQw4w9WgXcQQ')).toBe(false);
  });
});

describe('storageKeys', () => {
  it('should derive the source, automatic and custom thumbnail keys from the public id', () => {
    expect(storageKeys('dQw4w9WgXcQ')).toEqual({
      source: 'videos/dQw4w9WgXcQ/source',
      thumbnail: 'thumbnails/dQw4w9WgXcQ/auto.jpg',
      customThumbnail: 'thumbnails/dQw4w9WgXcQ/custom.jpg',
    });
  });
});
