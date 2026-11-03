import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { Request, Response } from 'express';

/** Mensaje que ve el usuario cuando ocurre un error no controlado. */
export const INTERNAL_ERROR_MESSAGE =
  'Ocurrió un error inesperado en el servidor. Intente de nuevo en unos minutos.';

/** Mensajes genéricos en español para respuestas HTTP sin mensaje propio. */
const STATUS_MESSAGES: Partial<Record<number, string>> = {
  [HttpStatus.BAD_REQUEST]: 'La solicitud no es válida.',
  [HttpStatus.UNAUTHORIZED]: 'Su sesión no es válida. Inicie sesión de nuevo.',
  [HttpStatus.FORBIDDEN]: 'No tiene permiso para realizar esta acción.',
  [HttpStatus.NOT_FOUND]: 'El recurso solicitado no existe.',
  [HttpStatus.METHOD_NOT_ALLOWED]: 'Esta operación no está permitida.',
  [HttpStatus.CONFLICT]: 'La operación entra en conflicto con datos existentes.',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'El archivo o los datos enviados son demasiado grandes.',
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: 'El tipo de archivo no es compatible.',
  [HttpStatus.TOO_MANY_REQUESTS]: 'Demasiados intentos. Espere un momento e intente de nuevo.',
  [HttpStatus.NOT_IMPLEMENTED]: 'Esta función todavía no está disponible.',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'El servicio no está disponible en este momento.',
};

/**
 * Mensajes en inglés que genera Nest/Express por su cuenta (no los escribimos
 * nosotros). Se reemplazan por el mensaje genérico en español del estado.
 */
const FRAMEWORK_MESSAGES = [
  /^Cannot (GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) /,
  /^Forbidden resource$/,
  /^Unauthorized$/,
  /^Internal server error$/i,
  /^Bad Request$/,
  /^Not Found$/,
  /^Forbidden$/,
  /^Conflict$/,
  /^Payload Too Large$/i,
  /^request entity too large$/i,
  /^Too Many Requests$/i,
  /^Unexpected token /,
  /^Unexpected end of JSON input$/,
  /is not valid JSON$/,
  /^File too large$/,
  /^Unexpected field$/,
];

const isFrameworkMessage = (message: string) => FRAMEWORK_MESSAGES.some((re) => re.test(message));

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request | undefined>();

    const status = this.statusOf(exception);
    const exceptionResponse = exception instanceof HttpException ? exception.getResponse() : null;

    let message = STATUS_MESSAGES[status] ?? INTERNAL_ERROR_MESSAGE;
    let details: unknown = undefined;
    let code: string | undefined;

    if (status >= 500 && !(exception instanceof HttpException)) {
      // Error no controlado: el detalle técnico (SQL, stack) solo va al registro.
      const reference = randomBytes(4).toString('hex').toUpperCase();
      this.logger.error(
        `[${reference}] ${request?.method ?? ''} ${request?.originalUrl ?? ''}: ${
          exception instanceof Error ? exception.message : String(exception)
        }`,
        exception instanceof Error ? exception.stack : undefined,
      );
      response.status(status).json({
        success: false,
        message: INTERNAL_ERROR_MESSAGE,
        data: { code: 'INTERNAL_ERROR', reference },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (exceptionResponse && typeof exceptionResponse === 'object') {
      const payload = exceptionResponse as {
        message?: string | string[];
        error?: string;
        reason?: string;
        code?: string;
        field?: string;
      };
      if (Array.isArray(payload.message)) {
        message = payload.message.join(payload.code === 'VALIDATION_ERROR' ? ' ' : ', ');
        details = payload.message;
      } else if (typeof payload.message === 'string') {
        message = payload.message;
      } else if (payload.error) {
        message = payload.error;
      }

      if (typeof payload.reason === 'string' && payload.reason.trim() && details === undefined) {
        details = { reason: payload.reason.trim() };
      }

      if (typeof payload.field === 'string' || typeof payload.code === 'string') {
        const extra = {
          ...(typeof payload.code === 'string' ? { code: payload.code } : {}),
          ...(typeof payload.field === 'string' ? { field: payload.field } : {}),
        };
        details =
          details && typeof details === 'object' && !Array.isArray(details)
            ? { ...details, ...extra }
            : { ...(Array.isArray(details) ? { messages: details } : {}), ...extra };
      }
    } else if (exception instanceof Error && exception.message) {
      // Errores con estado HTTP propio (p. ej. body-parser) que no son HttpException.
      message = exception.message;
    }

    if (isFrameworkMessage(message)) {
      if (/^Cannot [A-Z]+ /.test(message)) code = 'ROUTE_NOT_FOUND';
      else if (/JSON|Unexpected token|Unexpected end/.test(message)) code = 'INVALID_JSON';
      message =
        code === 'INVALID_JSON'
          ? 'Los datos enviados tienen un formato inválido.'
          : (STATUS_MESSAGES[status] ?? INTERNAL_ERROR_MESSAGE);
      if (code) details = { code };
    }

    if (status >= 500) {
      this.logger.error(`${request?.method ?? ''} ${request?.originalUrl ?? ''}: ${message}`);
    }

    response.status(status).json({
      success: false,
      message,
      data: details ?? null,
      timestamp: new Date().toISOString(),
    });
  }

  private statusOf(exception: unknown): number {
    if (exception instanceof HttpException) return exception.getStatus();
    // body-parser y multer adjuntan `status`/`statusCode` a errores comunes.
    const candidate = exception as { status?: unknown; statusCode?: unknown } | null;
    const raw = candidate?.status ?? candidate?.statusCode;
    if (typeof raw === 'number' && raw >= 400 && raw < 500) return raw;
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }
}
