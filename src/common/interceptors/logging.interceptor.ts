import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    const { method, url, ip } = request;
    const userAgent = request.get('user-agent') || '';
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const { statusCode } = response;
          const contentLength = response.get('content-length');
          const responseTime = Date.now() - startTime;

          // Log successful requests
          this.logger.log(
            `${method} ${url} ${statusCode} ${contentLength || 0}b - ${responseTime}ms - ${ip} - ${userAgent}`,
          );
        },
        error: (_error: Error) => {
          const responseTime = Date.now() - startTime;

          // Error logging is handled by the exception filter
          // Just log the timing information
          this.logger.debug(
            `${method} ${url} - Error after ${responseTime}ms - ${ip}`,
          );
        },
      }),
    );
  }
}
