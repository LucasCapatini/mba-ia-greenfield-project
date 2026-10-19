import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RESERVED_NICKNAMES } from '../channels.constants';
import { UpdateChannelDto } from './update-channel.dto';

async function errorsFor(body: Record<string, unknown>): Promise<string[]> {
  const dto = plainToInstance(UpdateChannelDto, body);
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return errors.map((error) => error.property);
}

describe('UpdateChannelDto', () => {
  it('should accept a valid partial body', async () => {
    await expect(
      errorsFor({ nickname: 'novo_nick', name: '  Canal Novo  ' }),
    ).resolves.toEqual([]);
  });

  it.each(RESERVED_NICKNAMES)(
    'should reject the reserved nickname %s so it never reaches the database',
    async (nickname) => {
      await expect(errorsFor({ nickname })).resolves.toEqual(['nickname']);
    },
  );

  it.each(['Ab', 'ab', '@canal', 'Canal', 'com espaço', 'a'.repeat(51)])(
    'should reject the malformed nickname %j',
    async (nickname) => {
      await expect(errorsFor({ nickname })).resolves.toEqual(['nickname']);
    },
  );

  it('should accept the allowlist limits (3 and 50 chars)', async () => {
    await expect(errorsFor({ nickname: 'abc' })).resolves.toEqual([]);
    await expect(errorsFor({ nickname: 'a'.repeat(50) })).resolves.toEqual([]);
  });

  it.each([
    ['an empty name', { name: '' }, 'name'],
    ['a blank name', { name: '   ' }, 'name'],
    ['a name over 50 chars', { name: 'n'.repeat(51) }, 'name'],
    ['a null name', { name: null }, 'name'],
    ['a null nickname', { nickname: null }, 'nickname'],
    [
      'a description over 1000 chars',
      { description: 'd'.repeat(1001) },
      'description',
    ],
    ['an unknown field', { user_id: 'x' }, 'user_id'],
  ])('should reject %s', async (_label, body, property) => {
    await expect(errorsFor(body)).resolves.toEqual([property]);
  });

  it('should accept a null description to clear it', async () => {
    await expect(errorsFor({ description: null })).resolves.toEqual([]);
  });

  it('should trim the name', () => {
    const dto = plainToInstance(UpdateChannelDto, { name: '  Canal  ' });
    expect(dto.name).toBe('Canal');
  });
});
