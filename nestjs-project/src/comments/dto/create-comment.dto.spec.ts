import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateCommentDto } from './create-comment.dto';

async function check(text: unknown) {
  const dto = plainToInstance(CreateCommentDto, { text });
  const errors = await validate(dto);
  return { dto, valid: errors.length === 0 };
}

describe('CreateCommentDto', () => {
  it('should trim the text and keep inner line breaks', async () => {
    const { dto, valid } = await check('  Ótimo vídeo\nvaleu  ');

    expect(valid).toBe(true);
    expect(dto.text).toBe('Ótimo vídeo\nvaleu');
  });

  it.each([
    ['empty', ''],
    ['only whitespace', '   \n\t '],
    ['2001 characters', 'a'.repeat(2001)],
    ['not a string', 42],
  ])('should reject %s', async (_label, text) => {
    expect((await check(text)).valid).toBe(false);
  });

  it('should accept exactly 2000 characters, counted after the trim', async () => {
    const { dto, valid } = await check(`  ${'a'.repeat(2000)}  `);

    expect(valid).toBe(true);
    expect(dto.text).toHaveLength(2000);
  });
});
