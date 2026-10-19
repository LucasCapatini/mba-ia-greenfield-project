import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';

/**
 * A data decorada não pode ser anterior à data em `property` do mesmo objeto (ex.: `to` ≥ `from`).
 * Compara datas ISO `YYYY-MM-DD` como texto, que ordena igual à cronologia. Se qualquer um dos
 * lados estiver ausente, não opina — a obrigatoriedade e o formato são de outros decorators.
 */
export function IsNotBefore(
  property: string,
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return (target: object, propertyName: string | symbol) => {
    registerDecorator({
      name: 'isNotBefore',
      target: target.constructor,
      propertyName: propertyName as string,
      constraints: [property],
      options: {
        message: `$property must not be before ${property}`,
        ...validationOptions,
      },
      validator: {
        validate(value: unknown, args: ValidationArguments): boolean {
          const [otherProperty] = args.constraints as [string];
          const other = (args.object as Record<string, unknown>)[otherProperty];
          if (typeof value !== 'string' || typeof other !== 'string') {
            return true;
          }
          return value >= other;
        },
      },
    });
  };
}
