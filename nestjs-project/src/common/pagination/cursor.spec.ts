import { decodeCursor, encodeCursor, InvalidCursorException } from './cursor';

const ID = '6f1c2b0e-4b7a-4c1e-9f62-0d6c8c1f7a10';

describe('cursor', () => {
  it('should round-trip a position through an opaque base64url string', () => {
    const position = {
      sort: 'latest',
      value: '2026-10-19 12:00:00.123456',
      id: ID,
    };

    const cursor = encodeCursor(position);

    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeCursor(cursor, 'latest')).toEqual(position);
  });

  it('should keep a numeric sort value as text', () => {
    const cursor = encodeCursor({ sort: 'popular', value: '300', id: ID });

    expect(decodeCursor(cursor, 'popular').value).toBe('300');
  });

  it('should reject a cursor emitted for another sort', () => {
    const cursor = encodeCursor({ sort: 'latest', value: 'x', id: ID });

    expect(() => decodeCursor(cursor, 'popular')).toThrow(
      InvalidCursorException,
    );
  });

  it.each([
    ['garbage', 'xxx'],
    ['valid base64 but not JSON', Buffer.from('nope').toString('base64url')],
    [
      'JSON with the wrong shape',
      Buffer.from(JSON.stringify({ sort: 'latest' })).toString('base64url'),
    ],
    [
      'a non-uuid id',
      Buffer.from(JSON.stringify(['latest', 'v', 'not-a-uuid'])).toString(
        'base64url',
      ),
    ],
    [
      'an empty sort value',
      Buffer.from(JSON.stringify(['latest', '', ID])).toString('base64url'),
    ],
    [
      'a non-string part',
      Buffer.from(JSON.stringify(['latest', 300, ID])).toString('base64url'),
    ],
  ])('should reject %s as VALIDATION_ERROR', (_label, raw) => {
    let thrown: unknown;
    try {
      decodeCursor(raw, 'latest');
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(InvalidCursorException);
    expect(thrown).toMatchObject({
      httpStatus: 400,
      errorCode: 'VALIDATION_ERROR',
    });
  });
});
