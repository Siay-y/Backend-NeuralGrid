import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  DomainError,
  type DomainErrorCategory,
} from '../../../domain/errors/domain-error';

export interface ErrorResponseBody {
  statusCode: number;
  error: string;
  message: string | string[];
}

const STATUS_BY_CATEGORY: Record<DomainErrorCategory, HttpStatus> = {
  invalid: HttpStatus.UNPROCESSABLE_ENTITY,
  unauthorized: HttpStatus.UNAUTHORIZED,
  forbidden: HttpStatus.FORBIDDEN,
  not_found: HttpStatus.NOT_FOUND,
  conflict: HttpStatus.CONFLICT,
};

function statusCode(status: number): string {
  return (HttpStatus[status] as string | undefined) ?? 'ERROR';
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const body = this.toBody(exception);

    if (body.statusCode >= 500) {
      this.logger.error(
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(body.statusCode).json(body);
  }

  private toBody(exception: unknown): ErrorResponseBody {
    if (exception instanceof DomainError) {
      return {
        statusCode: STATUS_BY_CATEGORY[exception.category],
        error: exception.code,
        message: exception.message,
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      const message =
        typeof payload === 'object' && payload !== null && 'message' in payload
          ? (payload as { message: string | string[] }).message
          : exception.message;
      return { statusCode: status, error: statusCode(status), message };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: statusCode(HttpStatus.INTERNAL_SERVER_ERROR),
      message: 'Erro interno do servidor',
    };
  }
}
