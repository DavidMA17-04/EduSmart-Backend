import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse = exception instanceof HttpException ? exception.getResponse() : null;

    let message = 'Internal server error';
    let details: unknown = undefined;

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (exceptionResponse && typeof exceptionResponse === 'object') {
      const payload = exceptionResponse as {
        message?: string | string[];
        error?: string;
      };
      if (Array.isArray(payload.message)) {
        message = payload.message.join(', ');
        details = payload.message;
      } else if (typeof payload.message === 'string') {
        message = payload.message;
      } else if (payload.error) {
        message = payload.error;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    response.status(status).json({
      success: false,
      message,
      data: details ?? null,
      timestamp: new Date().toISOString(),
    });
  }
}
