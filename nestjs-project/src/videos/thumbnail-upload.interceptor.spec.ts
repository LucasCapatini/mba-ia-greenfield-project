import { BadRequestException, type ExecutionContext } from '@nestjs/common';
import { Readable } from 'node:stream';
import { lastValueFrom, of } from 'rxjs';
import { ThumbnailUploadInterceptor } from './thumbnail-upload.interceptor';
import { ThumbnailTooLargeException } from './videos.exceptions';

const BOUNDARY = 'thumbnail-boundary';
const MAX_BYTES = 1024;

function multipartBody(
  parts: Array<{
    name: string;
    filename?: string;
    type?: string;
    body: Buffer;
  }>,
): Buffer {
  const chunks: Buffer[] = [];
  for (const part of parts) {
    const disposition = part.filename
      ? `form-data; name="${part.name}"; filename="${part.filename}"`
      : `form-data; name="${part.name}"`;
    chunks.push(
      Buffer.from(
        `--${BOUNDARY}\r\nContent-Disposition: ${disposition}\r\n` +
          (part.type ? `Content-Type: ${part.type}\r\n` : '') +
          '\r\n',
      ),
      part.body,
      Buffer.from('\r\n'),
    );
  }
  chunks.push(Buffer.from(`--${BOUNDARY}--\r\n`));
  return Buffer.concat(chunks);
}

function requestFor(body: Buffer): Readable & Record<string, unknown> {
  const stream = Readable.from([body]) as Readable & Record<string, unknown>;
  stream.headers = {
    'content-type': `multipart/form-data; boundary=${BOUNDARY}`,
    'content-length': String(body.length),
  };
  return stream;
}

function contextFor(request: object): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({}),
    }),
  } as unknown as ExecutionContext;
}

describe('ThumbnailUploadInterceptor', () => {
  const interceptor = new ThumbnailUploadInterceptor({
    thumbnailMaxBytes: MAX_BYTES,
  } as never);
  const next = { handle: () => of('handled') };

  it('should parse the file field into req.file and continue', async () => {
    const request = requestFor(
      multipartBody([
        {
          name: 'file',
          filename: 'capa.png',
          type: 'image/png',
          body: Buffer.alloc(100, 1),
        },
      ]),
    );

    const result = await interceptor.intercept(contextFor(request), next);

    await expect(lastValueFrom(result)).resolves.toBe('handled');
    expect(request.file).toMatchObject({
      fieldname: 'file',
      mimetype: 'image/png',
      size: 100,
    });
  });

  it('should map a file above THUMBNAIL_MAX_BYTES to THUMBNAIL_TOO_LARGE (413)', async () => {
    const request = requestFor(
      multipartBody([
        {
          name: 'file',
          filename: 'grande.png',
          type: 'image/png',
          body: Buffer.alloc(MAX_BYTES + 1, 1),
        },
      ]),
    );

    const promise = interceptor.intercept(contextFor(request), next);

    await expect(promise).rejects.toBeInstanceOf(ThumbnailTooLargeException);
    await expect(promise).rejects.toMatchObject({
      httpStatus: 413,
      errorCode: 'THUMBNAIL_TOO_LARGE',
    });
  });

  it.each([
    [
      'an unexpected file field',
      [
        {
          name: 'image',
          filename: 'x.png',
          type: 'image/png',
          body: Buffer.alloc(10),
        },
      ],
    ],
    ['an extra text field', [{ name: 'note', body: Buffer.from('hi') }]],
  ])('should reject %s as a 400 BadRequestException', async (_label, parts) => {
    const request = requestFor(multipartBody(parts));

    await expect(
      interceptor.intercept(contextFor(request), next),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should leave req.file undefined for a non-multipart request', async () => {
    const request = Readable.from([Buffer.from('{}')]) as Readable &
      Record<string, unknown>;
    request.headers = { 'content-type': 'application/json' };

    const result = await interceptor.intercept(contextFor(request), next);

    await expect(lastValueFrom(result)).resolves.toBe('handled');
    expect(request.file).toBeUndefined();
  });
});
