import {
  ArgumentsHost,
  BadRequestException,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { HttpExceptionFilter, INTERNAL_ERROR_MESSAGE } from './http-exception.filter';
import { spanishValidationExceptionFactory } from '../utils/validation-messages.util';

function run(exception: unknown) {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ method: 'GET', originalUrl: '/api/v1/x' }),
    }),
  } as unknown as ArgumentsHost;
  new HttpExceptionFilter().catch(exception, host);
  return { status: (status.mock.calls[0] as unknown[])[0], body: json.mock.calls[0][0] };
}

describe('HttpExceptionFilter', () => {
  beforeEach(() => jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined));
  afterEach(() => jest.restoreAllMocks());

  it('oculta el detalle de errores no controlados y entrega una referencia', () => {
    const { status, body } = run(
      new Error("ER_NO_SUCH_TABLE: Table 'edusmart.users' doesn't exist"),
    );
    expect(status).toBe(500);
    expect(body.message).toBe(INTERNAL_ERROR_MESSAGE);
    expect(JSON.stringify(body)).not.toMatch(/ER_NO_SUCH_TABLE|edusmart/);
    expect(body.data).toEqual({ code: 'INTERNAL_ERROR', reference: expect.stringMatching(/^[0-9A-F]{8}$/) });
    expect(Logger.prototype.error).toHaveBeenCalledWith(
      expect.stringContaining('ER_NO_SUCH_TABLE'),
      expect.any(String),
    );
  });

  it('traduce el 404 de ruta inexistente de Nest', () => {
    const { status, body } = run(new NotFoundException('Cannot GET /api/v1/no-existe'));
    expect(status).toBe(404);
    expect(body.message).toBe('El recurso solicitado no existe.');
    expect(body.data).toEqual({ code: 'ROUTE_NOT_FOUND' });
  });

  it('traduce el 403 genérico de los guards', () => {
    const { status, body } = run(new ForbiddenException());
    expect(status).toBe(403);
    expect(body.message).toBe('No tiene permiso para realizar esta acción.');
  });

  it('respeta los mensajes de dominio en español', () => {
    const { body } = run(
      new NotFoundException({ message: 'El expediente no existe', code: 'CASE_NOT_FOUND' }),
    );
    expect(body.message).toBe('El expediente no existe');
    expect(body.data).toEqual({ code: 'CASE_NOT_FOUND' });
  });

  it('une los mensajes de validación como oraciones y conserva la lista', () => {
    const { status, body } = run(
      spanishValidationExceptionFactory([
        { property: 'email', constraints: { isEmail: 'email must be an email' }, children: [] },
        {
          property: 'firstName',
          constraints: { isNotEmpty: 'firstName should not be empty' },
          children: [],
        },
      ]),
    );
    expect(status).toBe(400);
    expect(body.message).toBe(
      'El campo «correo electrónico» debe ser un correo electrónico válido. El campo «nombre» es obligatorio.',
    );
    expect(body.data.code).toBe('VALIDATION_ERROR');
    expect(body.data.messages).toHaveLength(2);
  });

  it('traduce el JSON mal formado de body-parser', () => {
    const err = Object.assign(new SyntaxError('Unexpected token } in JSON at position 9'), {
      status: 400,
    });
    const { status, body } = run(err);
    expect(status).toBe(400);
    expect(body.message).toBe('Los datos enviados tienen un formato inválido.');
  });

  it('traduce el BadRequest sin mensaje', () => {
    const { body } = run(new BadRequestException());
    expect(body.message).toBe('La solicitud no es válida.');
  });
});
