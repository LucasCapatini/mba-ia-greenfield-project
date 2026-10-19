import { deriveVideoTitle } from './video-title.util';
import { VIDEO_TITLE_MAX_LENGTH } from './videos.constants';

describe('deriveVideoTitle', () => {
  it.each([
    ['Minha aula.final.mp4', 'Minha aula.final'],
    ['a.mp4', 'a'],
    ['clip.WEBM', 'clip'],
    ['no-extension', 'no-extension'],
    ['  spaced name .mp4  ', 'spaced name'],
    ['.mp4', '.mp4'],
  ])('should derive %j as %j', (filename, expected) => {
    expect(deriveVideoTitle(filename)).toBe(expected);
  });

  it('should truncate to the title limit', () => {
    const title = deriveVideoTitle(`${'x'.repeat(150)}.mp4`);

    expect(title).toHaveLength(VIDEO_TITLE_MAX_LENGTH);
    expect(title).toBe('x'.repeat(VIDEO_TITLE_MAX_LENGTH));
  });

  it('should count code points so an emoji is never split', () => {
    const title = deriveVideoTitle(`${'😀'.repeat(120)}.mp4`);

    expect(Array.from(title)).toHaveLength(VIDEO_TITLE_MAX_LENGTH);
    expect(title).toBe('😀'.repeat(VIDEO_TITLE_MAX_LENGTH));
  });
});
