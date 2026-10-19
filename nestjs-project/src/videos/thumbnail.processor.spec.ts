import sharp from 'sharp';
import { ThumbnailProcessor } from './thumbnail.processor';
import { ThumbnailInvalidException } from './videos.exceptions';

function image(
  width: number,
  height: number,
  format: 'png' | 'jpeg' | 'webp' | 'gif' = 'png',
): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 200, g: 40, b: 40 },
    },
  })
    .toFormat(format)
    .toBuffer();
}

describe('ThumbnailProcessor', () => {
  const processor = new ThumbnailProcessor();

  it('should turn a PNG 800×450 into a JPEG 1280×720', async () => {
    const output = await processor.normalize(
      await image(800, 450),
      'image/png',
    );

    const metadata = await sharp(output).metadata();
    expect(metadata.format).toBe('jpeg');
    expect(metadata.width).toBe(1280);
    expect(metadata.height).toBe(720);
  });

  it.each([
    ['jpeg', 'image/jpeg'],
    ['webp', 'image/webp'],
  ] as const)(
    'should accept a %s input and still output JPEG 1280×720',
    async (format, mime) => {
      const output = await processor.normalize(
        await image(1920, 1080, format),
        mime,
      );

      const metadata = await sharp(output).metadata();
      expect([metadata.format, metadata.width, metadata.height]).toEqual([
        'jpeg',
        1280,
        720,
      ]);
    },
  );

  it('should crop a non-16:9 image to cover 1280×720', async () => {
    const output = await processor.normalize(
      await image(1000, 1000),
      'image/png',
    );

    const metadata = await sharp(output).metadata();
    expect([metadata.width, metadata.height]).toEqual([1280, 720]);
  });

  it('should accept exactly the 640×360 minimum', async () => {
    await expect(
      processor.normalize(await image(640, 360), 'image/png'),
    ).resolves.toBeInstanceOf(Buffer);
  });

  it.each([
    [320, 180],
    [639, 360],
    [640, 359],
  ])('should reject %d×%d as THUMBNAIL_INVALID', async (width, height) => {
    const promise = processor.normalize(
      await image(width, height),
      'image/png',
    );

    await expect(promise).rejects.toBeInstanceOf(ThumbnailInvalidException);
    await expect(promise).rejects.toMatchObject({
      httpStatus: 400,
      errorCode: 'THUMBNAIL_INVALID',
    });
  });

  it('should reject bytes that are not an image', async () => {
    await expect(
      processor.normalize(Buffer.from('não sou imagem'), 'image/png'),
    ).rejects.toBeInstanceOf(ThumbnailInvalidException);
  });

  it('should reject a declared type outside the allow-list even with valid bytes', async () => {
    await expect(
      processor.normalize(await image(800, 450), 'text/plain'),
    ).rejects.toBeInstanceOf(ThumbnailInvalidException);
  });

  it('should reject a real image whose format is not allowed (GIF declared as PNG)', async () => {
    await expect(
      processor.normalize(await image(800, 450, 'gif'), 'image/png'),
    ).rejects.toBeInstanceOf(ThumbnailInvalidException);
  });
});
