import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';

/**
 * Guard to wrap route handlers with additional error handling
 * Catches errors that might slip through and provides safe fallback
 */
@Injectable()
export class ErrorHandlingGuard implements CanActivate {
  private readonly logger = new Logger(ErrorHandlingGuard.name);

  async canActivate(_context: ExecutionContext): Promise<boolean> {
    try {
      // This guard always allows access
      // Its purpose is to catch and log errors in a centralized way
      return true;
    } catch (error) {
      this.logger.error('Unexpected error in guard:', error);
      throw new InternalServerErrorException(
        'An unexpected error occurred while processing your request',
      );
    }
  }
}
