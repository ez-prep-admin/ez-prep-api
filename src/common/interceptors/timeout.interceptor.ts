import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  RequestTimeoutException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, throwError, TimeoutError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import { SKIP_TIMEOUT_KEY } from '../decorators/skip-timeout.decorator';

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Interceptor to prevent long-running requests from hanging.
 * Handlers decorated with @SkipTimeout() are not subject to this limit.
 */
@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const skipTimeout = this.reflector.getAllAndOverride<boolean>(
      SKIP_TIMEOUT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (skipTimeout) {
      return next.handle();
    }

    return next.handle().pipe(
      timeout(DEFAULT_TIMEOUT_MS),
      catchError(err => {
        if (err instanceof TimeoutError) {
          return throwError(
            () =>
              new RequestTimeoutException(
                'Request timeout. The operation took too long to complete.',
              ),
          );
        }
        return throwError(() => err);
      }),
    );
  }
}
