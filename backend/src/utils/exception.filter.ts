import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse = exception instanceof HttpException ? exception.getResponse() : null;
    
    const message =
      exception instanceof HttpException
        ? (exceptionResponse as any).message || exception.message
        : (exception as any).message || 'Internal server error';

    const code = (exceptionResponse as any)?.code || (status === HttpStatus.OK ? 0 : status);

    response.status(status).json({
      code,
      data: {},
      msg: Array.isArray(message) ? message.join(', ') : message,
    });
  }
}
