import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { exportSpec } from './openapi-export';

describe('exportSpec (integration)', () => {
  let outputPath: string;
  let document: Record<string, unknown>;

  beforeAll(async () => {
    outputPath = join(tmpdir(), `openapi-test-${Date.now()}.json`);
    await exportSpec(outputPath);
    document = JSON.parse(readFileSync(outputPath, 'utf-8')) as Record<
      string,
      unknown
    >;
  }, 30_000);

  it('exports a valid OpenAPI 3.x document', () => {
    expect(document.openapi).toMatch(/^3\./);
  });

  it('sets info.title to "StreamTube API"', () => {
    const info = document.info as Record<string, unknown>;
    expect(info.title).toBe('StreamTube API');
  });

  it('sets info.version to "1.0"', () => {
    const info = document.info as Record<string, unknown>;
    expect(info.version).toBe('1.0');
  });

  it('includes access-token Bearer security scheme', () => {
    const components = document.components as Record<string, unknown>;
    const schemes = components.securitySchemes as Record<
      string,
      Record<string, unknown>
    >;
    expect(schemes['access-token']).toMatchObject({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    });
  });

  it('includes non-empty components.schemas from DTO inference', () => {
    const components = document.components as Record<string, unknown>;
    const schemas = components.schemas as Record<string, unknown>;
    expect(Object.keys(schemas).length).toBeGreaterThan(0);
  });

  it('includes ApiErrorEnvelope schema with expected properties', () => {
    const components = document.components as Record<string, unknown>;
    const schemas = components.schemas as Record<
      string,
      Record<string, unknown>
    >;
    expect(schemas['ApiErrorEnvelope']).toBeDefined();
    const props = schemas['ApiErrorEnvelope'].properties as Record<
      string,
      unknown
    >;
    expect(props).toHaveProperty('statusCode');
    expect(props).toHaveProperty('error');
    expect(props).toHaveProperty('message');
    expect(props).toHaveProperty('code');
  });

  it('has at least one path with a 401 response referencing ApiErrorEnvelope', () => {
    const paths = document.paths as Record<
      string,
      Record<string, Record<string, unknown>>
    >;
    const apiErrorRef = '#/components/schemas/ApiErrorEnvelope';

    const hasRef = Object.values(paths).some((methods) =>
      Object.values(methods).some((operation) => {
        const responses = operation.responses as Record<
          string,
          Record<string, unknown>
        >;
        const r401 = responses?.['401'];
        if (!r401) return false;
        const content = r401.content as Record<string, Record<string, unknown>>;
        const jsonContent = content?.['application/json'];
        const schema = jsonContent?.schema as Record<string, unknown>;
        return schema?.['$ref'] === apiErrorRef;
      }),
    );

    expect(hasRef).toBe(true);
  });

  it('protected auth endpoints include access-token security requirement', () => {
    const paths = document.paths as Record<
      string,
      Record<string, Record<string, unknown>>
    >;
    const protectedPaths = [
      { path: '/auth/logout', method: 'post' },
      { path: '/auth/me', method: 'get' },
    ];

    for (const { path, method } of protectedPaths) {
      const operation = paths[path]?.[method];
      expect(operation).toBeDefined();
      const security = operation?.security as Array<Record<string, unknown>>;
      expect(security).toBeDefined();
      expect(security.some((req) => 'access-token' in req)).toBe(true);
    }
  });

  it('all auth endpoints have a non-empty summary', () => {
    const paths = document.paths as Record<
      string,
      Record<string, Record<string, unknown>>
    >;
    const authPaths = Object.entries(paths).filter(([p]) =>
      p.startsWith('/auth/'),
    );

    expect(authPaths.length).toBeGreaterThan(0);

    for (const [, methods] of authPaths) {
      for (const operation of Object.values(methods)) {
        expect(typeof operation.summary).toBe('string');
        expect((operation.summary as string).length).toBeGreaterThan(0);
      }
    }
  });

  describe('explicit contract for the account-confirmation / reset flows (SI-6)', () => {
    type Schema = { required?: string[]; properties?: Record<string, unknown> };
    type Param = { name: string; in: string; required?: boolean };

    const schemas = () =>
      (document.components as { schemas: Record<string, Schema> }).schemas;
    const paths = () =>
      document.paths as Record<
        string,
        Record<string, { parameters?: Param[] }>
      >;

    it('GET /auth/confirm-email declares the required `token` query parameter', () => {
      const params = paths()['/auth/confirm-email'].get.parameters ?? [];
      const token = params.find((p) => p.name === 'token');

      expect(token).toBeDefined();
      expect(token?.in).toBe('query');
      expect(token?.required).toBe(true);
    });

    it('ResetPasswordDto declares token and new_password (8..128) as required', () => {
      const dto = schemas().ResetPasswordDto;

      expect(dto.required).toEqual(
        expect.arrayContaining(['token', 'new_password']),
      );
      expect(dto.properties).toMatchObject({
        token: { type: 'string' },
        new_password: { type: 'string', minLength: 8, maxLength: 128 },
      });
    });

    it('ResendConfirmationDto declares a required e-mail', () => {
      const dto = schemas().ResendConfirmationDto;

      expect(dto.required).toEqual(['email']);
      expect(dto.properties).toMatchObject({
        email: { type: 'string', format: 'email' },
      });
    });
  });
  describe('video upload/processing/playback contract (phase 03)', () => {
    type Operation = {
      summary?: string;
      security?: Array<Record<string, unknown>>;
      responses: Record<string, unknown>;
    };
    const paths = () =>
      document.paths as Record<string, Record<string, Operation>>;
    const schemas = () =>
      (
        document.components as {
          schemas: Record<string, { properties?: Record<string, unknown> }>;
        }
      ).schemas;

    it.each([
      ['/videos', 'post', ['201', '400', '401', '413', '503']],
      ['/videos/{publicId}', 'get', ['200', '401', '403', '404', '503']],
      [
        '/videos/{publicId}/playback',
        'get',
        ['200', '401', '403', '404', '409', '503'],
      ],
      [
        '/videos/{publicId}/upload/parts',
        'post',
        ['200', '400', '401', '403', '404', '409', '503'],
      ],
      [
        '/videos/{publicId}/upload',
        'get',
        ['200', '401', '403', '404', '409', '503'],
      ],
      [
        '/videos/{publicId}/upload/complete',
        'post',
        ['202', '400', '401', '403', '404', '409', '413', '422', '503'],
      ],
      [
        '/videos/{publicId}/upload',
        'delete',
        ['204', '401', '403', '404', '409', '503'],
      ],
    ])(
      '%s %s documents the status codes of the API contract and requires the access token',
      (path, method, statuses) => {
        const operation = paths()[path]?.[method];

        expect(operation).toBeDefined();
        expect(Object.keys(operation.responses).sort()).toEqual(
          [...statuses].sort(),
        );
        expect(operation.security?.some((req) => 'access-token' in req)).toBe(
          true,
        );
        expect((operation.summary ?? '').length).toBeGreaterThan(0);
      },
    );

    it('exposes processing_status, processing_error, upload state and content_type as enums', () => {
      expect(schemas().VideoResponse.properties).toMatchObject({
        processing_status: {
          enum: ['uploading', 'processing', 'ready', 'failed'],
        },
        processing_error: {
          enum: [
            'UNSUPPORTED_FORMAT',
            'PROBE_FAILED',
            'THUMBNAIL_FAILED',
            'OBJECT_MISSING',
          ],
          nullable: true,
        },
      });
      expect(schemas().UploadStateResponse.properties).toMatchObject({
        state: { enum: ['active', 'completed', 'aborted', 'expired'] },
      });
      expect(schemas().CreateVideoDto.properties).toMatchObject({
        content_type: { enum: ['video/mp4', 'video/webm'] },
      });
    });

    it('declares the playback and upload response shapes consumed by the frontend', () => {
      expect(Object.keys(schemas().PlaybackResponse.properties ?? {})).toEqual([
        'stream_url',
        'download_url',
        'thumbnail_url',
        'expires_at',
      ]);
      expect(
        Object.keys(schemas().VideoCreatedResponse.properties ?? {}),
      ).toEqual(['public_id', 'status', 'processing_status', 'upload']);
      expect(
        Object.keys(schemas().UploadCompletedResponse.properties ?? {}),
      ).toEqual(['public_id', 'status', 'processing_status', 'size_bytes']);
    });
  });
});
