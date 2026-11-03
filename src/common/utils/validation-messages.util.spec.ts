import 'reflect-metadata';
import { Type } from 'class-transformer';
import { plainToInstance } from 'class-transformer';
import {
  ArrayMinSize,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
  validate,
} from 'class-validator';
import {
  flattenValidationErrors,
  spanishValidationExceptionFactory,
  translateConstraint,
} from './validation-messages.util';

enum Color {
  RED = 'RED',
  BLUE = 'BLUE',
}

class ItemDto {
  @IsString()
  @MinLength(2)
  name!: string;
}

class SampleDto {
  @IsString()
  @MinLength(2)
  firstName!: string;

  @IsEmail()
  email!: string;

  @IsInt()
  @Min(1)
  @Max(50)
  pageSize!: number;

  @IsEnum(Color)
  color!: Color;

  @IsNotEmpty({ message: 'Indique el motivo de la salida.' })
  reason!: string;

  @MaxLength(5)
  code!: string;

  @ValidateNested({ each: true })
  @Type(() => ItemDto)
  @ArrayMinSize(1)
  items!: ItemDto[];
}

describe('validation-messages.util', () => {
  it('traduce los mensajes por defecto a español con el nombre visible del campo', async () => {
    const dto = plainToInstance(SampleDto, {
      firstName: 'A',
      email: 'no-es-correo',
      pageSize: 99,
      color: 'GREEN',
      reason: '',
      code: 'ABCDEFG',
      items: [{ name: 'x' }],
    });
    const messages = flattenValidationErrors(await validate(dto));

    expect(messages).toEqual(
      expect.arrayContaining([
        'El campo «nombre» debe tener al menos 2 caracteres.',
        'El campo «correo electrónico» debe ser un correo electrónico válido.',
        'El campo «tamaño de página» no puede ser mayor que 50.',
        'El campo «color» debe ser uno de estos valores: RED, BLUE.',
        'El campo «código» no puede superar 5 caracteres.',
      ]),
    );
    expect(messages.every((m) => !/must|should/.test(m))).toBe(true);
  });

  it('reporta un solo mensaje por campo, empezando por el obligatorio', async () => {
    const dto = plainToInstance(SampleDto, { reason: 'x', code: 'a', items: [{ name: 'xx' }] });
    const messages = flattenValidationErrors(await validate(dto));
    expect(messages.filter((m) => m.includes('«nombre»'))).toEqual([
      'El campo «nombre» debe ser un texto.',
    ]);
  });

  it('respeta los mensajes personalizados del DTO', async () => {
    const dto = plainToInstance(SampleDto, { reason: '' });
    const messages = flattenValidationErrors(await validate(dto));
    expect(messages).toContain('Indique el motivo de la salida.');
  });

  it('incluye los errores de objetos anidados', async () => {
    const dto = plainToInstance(SampleDto, { items: [{ name: 'x' }] });
    const messages = flattenValidationErrors(await validate(dto));
    expect(messages).toContain('El campo «nombre» debe tener al menos 2 caracteres.');
  });

  it('traduce el campo no permitido (whitelist)', () => {
    expect(
      translateConstraint('foo', 'whitelistValidation', 'property foo should not exist'),
    ).toBe('El campo «foo» no está permitido en esta solicitud.');
  });

  it('usa singular cuando el límite es 1', () => {
    expect(
      translateConstraint('name', 'minLength', 'name must be longer than or equal to 1 characters'),
    ).toBe('El campo «nombre» debe tener al menos 1 carácter.');
  });

  it('traduce "each value in" para validaciones de listas', () => {
    expect(
      translateConstraint('roleIds', 'isInt', 'each value in roleIds must be an integer number'),
    ).toBe('El campo «roles» (cada valor) debe ser un número entero.');
  });

  it('la fábrica devuelve 400 con código VALIDATION_ERROR', () => {
    const error = spanishValidationExceptionFactory([
      { property: 'email', constraints: { isEmail: 'email must be an email' }, children: [] },
    ]);
    expect(error.getStatus()).toBe(400);
    expect(error.getResponse()).toMatchObject({
      code: 'VALIDATION_ERROR',
      message: ['El campo «correo electrónico» debe ser un correo electrónico válido.'],
    });
  });
});
