import { HttpStatus } from '@nestjs/common';
import {
  AuthenticationError,
  DatabaseConnectionError,
  DuplicateResourceError,
  ExternalServiceError,
  InvalidOperationError,
  RateLimitError,
  ResourceNotFoundError,
  UnauthorizedAccessError,
  ValidationError,
} from './custom-errors';

describe('custom errors', () => {
  it('should use default and custom DatabaseConnectionError messages', () => {
    expect(new DatabaseConnectionError().getStatus()).toBe(
      HttpStatus.SERVICE_UNAVAILABLE,
    );
    expect(new DatabaseConnectionError('down').getResponse()).toEqual(
      expect.objectContaining({ message: 'down' }),
    );
  });

  it('should format ResourceNotFoundError with and without identifier', () => {
    expect(
      (new ResourceNotFoundError('User').getResponse() as any).message,
    ).toBe('User not found');
    expect(
      (new ResourceNotFoundError('User', '1').getResponse() as any).message,
    ).toBe("User with identifier '1' not found");
  });

  it('should format DuplicateResourceError with and without field', () => {
    expect(
      (new DuplicateResourceError('User').getResponse() as any).message,
    ).toBe('User already exists');
    expect(
      (new DuplicateResourceError('User', 'email').getResponse() as any)
        .message,
    ).toBe('User with this email already exists');
  });

  it('should create remaining error types', () => {
    expect(new InvalidOperationError('nope').getStatus()).toBe(
      HttpStatus.BAD_REQUEST,
    );
    expect(new UnauthorizedAccessError().getStatus()).toBe(HttpStatus.FORBIDDEN);
    expect(new AuthenticationError().getStatus()).toBe(HttpStatus.UNAUTHORIZED);
    expect(new RateLimitError().getStatus()).toBe(
      HttpStatus.TOO_MANY_REQUESTS,
    );
    expect(new ExternalServiceError('S3').getResponse()).toEqual(
      expect.objectContaining({ message: 'S3 is currently unavailable' }),
    );
    expect(new ExternalServiceError('S3', 'timeout').getResponse()).toEqual(
      expect.objectContaining({ message: 'S3 error: timeout' }),
    );
  });

  it('should include validation details when provided', () => {
    const without = new ValidationError('bad').getResponse() as any;
    expect(without.details).toBeUndefined();

    const withDetails = new ValidationError('bad', [{ field: 'x' }]).getResponse() as any;
    expect(withDetails.details).toEqual([{ field: 'x' }]);
  });
});
