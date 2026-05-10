import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Custom error classes for specific business logic errors
 */

export class DatabaseConnectionError extends HttpException {
  constructor(message = 'Unable to connect to the database') {
    super(
      {
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        error: 'DatabaseConnectionError',
        message,
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}

export class ResourceNotFoundError extends HttpException {
  constructor(resource: string, identifier?: string) {
    const message = identifier
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
    super(
      {
        statusCode: HttpStatus.NOT_FOUND,
        error: 'ResourceNotFound',
        message,
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class DuplicateResourceError extends HttpException {
  constructor(resource: string, field?: string) {
    const message = field
      ? `${resource} with this ${field} already exists`
      : `${resource} already exists`;
    super(
      {
        statusCode: HttpStatus.CONFLICT,
        error: 'DuplicateResource',
        message,
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class InvalidOperationError extends HttpException {
  constructor(message: string) {
    super(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'InvalidOperation',
        message,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class UnauthorizedAccessError extends HttpException {
  constructor(message = 'You do not have permission to access this resource') {
    super(
      {
        statusCode: HttpStatus.FORBIDDEN,
        error: 'UnauthorizedAccess',
        message,
      },
      HttpStatus.FORBIDDEN,
    );
  }
}

export class AuthenticationError extends HttpException {
  constructor(message = 'Authentication failed. Please log in again.') {
    super(
      {
        statusCode: HttpStatus.UNAUTHORIZED,
        error: 'AuthenticationError',
        message,
      },
      HttpStatus.UNAUTHORIZED,
    );
  }
}

export class ValidationError extends HttpException {
  constructor(message: string, errors?: any[]) {
    super(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'ValidationError',
        message,
        ...(errors && { details: errors }),
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class RateLimitError extends HttpException {
  constructor(message = 'Too many requests. Please try again later.') {
    super(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        error: 'RateLimitExceeded',
        message,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

export class ExternalServiceError extends HttpException {
  constructor(service: string, message?: string) {
    const errorMessage = message
      ? `${service} error: ${message}`
      : `${service} is currently unavailable`;
    super(
      {
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        error: 'ExternalServiceError',
        message: errorMessage,
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}
