import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ThrottlerException } from '@nestjs/throttler';
import { MongoError } from 'mongodb';
import { Error as MongooseError } from 'mongoose';

interface ValidationErrorDetail {
  field?: string;
  message?: string;
  [key: string]: unknown;
}

interface ErrorResponse {
  statusCode: number;
  error: string;
  message: string | string[];
  timestamp: string;
  path: string;
  method: string;
  details?: ValidationErrorDetail[];
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);
  private readonly isProduction = process.env.NODE_ENV === 'production';

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let message: string | string[];
    let error: string;
    let details: ValidationErrorDetail[] | undefined = undefined;

    // Handle different types of exceptions
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const responseObj = exceptionResponse as {
          message?: string | string[];
          error?: string;
          errors?: ValidationErrorDetail[] | string[];
          details?: ValidationErrorDetail[] | string[];
        };
        message = responseObj.message || exception.message;
        error = responseObj.error || exception.name;
        if (responseObj.errors) {
          details = Array.isArray(responseObj.errors)
            ? responseObj.errors.map(entry =>
                typeof entry === 'string' ? { message: entry } : entry,
              )
            : responseObj.errors;
        } else if (responseObj.details) {
          details = Array.isArray(responseObj.details)
            ? responseObj.details.map(entry =>
                typeof entry === 'string' ? { message: entry } : entry,
              )
            : responseObj.details;
        }
      } else {
        message = exceptionResponse as string;
        error = exception.name;
      }
    } else if (exception instanceof ThrottlerException) {
      status = HttpStatus.TOO_MANY_REQUESTS;
      message = 'Too many requests. Please try again later.';
      error = 'TooManyRequests';
    } else if (this.isMongoError(exception)) {
      // Handle MongoDB errors
      const mongoError = exception as MongoError;
      const result = this.handleMongoError(mongoError);
      status = result.status;
      message = result.message;
      error = result.error;
    } else if (exception instanceof MongooseError.ValidationError) {
      // Handle Mongoose validation errors
      status = HttpStatus.BAD_REQUEST;
      error = 'ValidationError';
      message = 'Database validation failed';
      details = Object.values(exception.errors).map((err: any) => ({
        field: err.path,
        message: err.message,
        value: err.value,
      }));
    } else if (exception instanceof MongooseError.CastError) {
      // Handle invalid ObjectId or type casting errors
      status = HttpStatus.BAD_REQUEST;
      error = 'InvalidId';
      message = `Invalid ${exception.path}: ${exception.value}`;
    } else if (
      exception instanceof Error &&
      exception.name === 'JsonWebTokenError'
    ) {
      // Handle JWT errors
      status = HttpStatus.UNAUTHORIZED;
      error = 'InvalidToken';
      message = 'Invalid or malformed authentication token';
    } else if (
      exception instanceof Error &&
      exception.name === 'TokenExpiredError'
    ) {
      // Handle expired JWT
      status = HttpStatus.UNAUTHORIZED;
      error = 'TokenExpired';
      message = 'Authentication token has expired';
    } else if (
      exception instanceof Error &&
      exception.name === 'NotBeforeError'
    ) {
      // Handle JWT not yet valid
      status = HttpStatus.UNAUTHORIZED;
      error = 'TokenNotActive';
      message = 'Authentication token is not yet active';
    } else if (exception instanceof Error) {
      // Handle other known errors
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      error = 'InternalServerError';
      message = this.isProduction
        ? 'An unexpected error occurred. Please try again later.'
        : exception.message;

      // Log the full error for debugging
      this.logger.error(
        `Unexpected Error: ${exception.message}`,
        exception.stack,
      );
    } else {
      // Handle completely unknown errors
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = this.isProduction
        ? 'An unexpected error occurred. Please try again later.'
        : 'Internal server error';
      error = 'UnknownError';

      this.logger.error(
        `Unknown error type: ${JSON.stringify(exception)}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    // Build error response
    const errorResponse: ErrorResponse = {
      statusCode: status,
      error,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
    };

    // Only include details in non-production or for client errors
    if (details && (!this.isProduction || status < 500)) {
      errorResponse.details = details;
    }

    // Log errors appropriately
    this.logError(status, request, message, exception);

    response.status(status).json(errorResponse);
  }

  /**
   * Check if error is a MongoDB error
   */
  private isMongoError(exception: unknown): exception is MongoError {
    return (
      exception instanceof Error &&
      (exception.name === 'MongoError' ||
        exception.name === 'MongoServerError' ||
        'code' in exception)
    );
  }

  /**
   * Handle MongoDB-specific errors
   */
  private handleMongoError(error: MongoError): {
    status: number;
    message: string;
    error: string;
  } {
    const code = (error as any).code;

    switch (code) {
      case 11000:
      case 11001:
        // Duplicate key error
        const field = this.extractDuplicateField(error);
        return {
          status: HttpStatus.CONFLICT,
          message: field
            ? `A record with this ${field} already exists`
            : 'Duplicate entry. A record with this value already exists.',
          error: 'DuplicateEntry',
        };

      case 121:
        // Document validation failed
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'Document validation failed',
          error: 'ValidationError',
        };

      default:
        this.logger.error(`MongoDB Error (code ${code}): ${error.message}`);
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: this.isProduction
            ? 'A database error occurred'
            : error.message,
          error: 'DatabaseError',
        };
    }
  }

  /**
   * Extract field name from duplicate key error
   */
  private extractDuplicateField(error: MongoError): string | null {
    const message = error.message;
    const match = message.match(/index: (\w+)_/);
    return match ? match[1] : null;
  }

  /**
   * Log errors with appropriate level
   */
  private logError(
    status: number,
    request: Request,
    message: string | string[],
    exception: unknown,
  ): void {
    const logMessage = `${request.method} ${request.url} - ${status}`;

    if (status >= 500) {
      // Server errors - log as error
      this.logger.error(
        `${logMessage} - ${this.stringifyMessage(message)}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else if (status >= 400 && status !== 400 && status !== 401) {
      // Client errors except validation (400) and auth (401) - log as warning
      this.logger.warn(`${logMessage} - ${this.stringifyMessage(message)}`);
    }
    // Validation and auth errors are not logged to avoid spam
  }

  /**
   * Convert message to string for logging
   */
  private stringifyMessage(message: string | string[]): string {
    return Array.isArray(message) ? message.join(', ') : message;
  }
}
