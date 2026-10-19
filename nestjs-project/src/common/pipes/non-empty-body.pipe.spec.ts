import { BadRequestException } from '@nestjs/common';
import { NonEmptyBodyPipe } from './non-empty-body.pipe';

describe('NonEmptyBodyPipe', () => {
  const pipe = new NonEmptyBodyPipe();

  it('should pass a body with at least one defined field through unchanged', () => {
    const body = { title: 'Novo', description: undefined };

    expect(pipe.transform(body)).toBe(body);
  });

  it('should count an explicit null as a present field', () => {
    const body = { category_id: null };

    expect(pipe.transform(body)).toBe(body);
  });

  it.each([
    ['an empty object', {}],
    ['only undefined fields', { title: undefined, visibility: undefined }],
    ['null', null],
    ['undefined', undefined],
  ])('should reject %s with a BadRequestException', (_label, body) => {
    expect(() => pipe.transform(body)).toThrow(BadRequestException);
  });

  it('should report the reason as a validation message list', () => {
    let thrown: unknown;
    try {
      pipe.transform({});
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(BadRequestException);
    expect((thrown as BadRequestException).getResponse()).toMatchObject({
      message: ['body must contain at least one field'],
    });
  });
});
