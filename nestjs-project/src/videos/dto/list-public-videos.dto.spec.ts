import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListPublicVideosDto } from './list-videos.dto';

async function errorsFor(query: Record<string, unknown>): Promise<string[]> {
  const dto = plainToInstance(ListPublicVideosDto, query);
  const errors = await validate(dto);
  return errors.map((error) => error.property);
}

describe('ListPublicVideosDto', () => {
  it('should accept an empty query with the default limit', async () => {
    const dto = plainToInstance(ListPublicVideosDto, {});

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.limit).toBe(20);
  });

  it('should trim q before validating its length', async () => {
    const dto = plainToInstance(ListPublicVideosDto, { q: '  ab  ' });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.q).toBe('ab');
  });

  it('should accept q with 2 and with 100 characters', async () => {
    await expect(errorsFor({ q: 'ab' })).resolves.toEqual([]);
    await expect(errorsFor({ q: 'x'.repeat(100) })).resolves.toEqual([]);
  });

  it('should reject q with 1 character, only spaces or more than 100 characters', async () => {
    await expect(errorsFor({ q: 'a' })).resolves.toEqual(['q']);
    await expect(errorsFor({ q: '   ' })).resolves.toEqual(['q']);
    await expect(errorsFor({ q: 'x'.repeat(101) })).resolves.toEqual(['q']);
  });

  it('should accept an optional category slug', async () => {
    await expect(errorsFor({ category: 'music' })).resolves.toEqual([]);
  });

  it('should keep the cursor pagination rules', async () => {
    await expect(errorsFor({ limit: '51' })).resolves.toEqual(['limit']);
    await expect(errorsFor({ limit: '50', cursor: 'abc' })).resolves.toEqual(
      [],
    );
  });
});
