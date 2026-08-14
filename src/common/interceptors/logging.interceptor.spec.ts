import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of, throwError, firstValueFrom } from 'rxjs';
import { LoggingInterceptor } from './logging.interceptor';

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;
  const request = {
    method: 'GET',
    url: '/health',
    ip: '127.0.0.1',
    get: jest.fn().mockReturnValue('jest-agent'),
  };
  const response = {
    statusCode: 200,
    get: jest.fn().mockReturnValue('12'),
  };
  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ExecutionContext;

  beforeEach(() => {
    interceptor = new LoggingInterceptor();
    jest.clearAllMocks();
    request.get.mockReturnValue('jest-agent');
    response.get.mockReturnValue('12');
  });

  it('should log successful requests', async () => {
    const next = { handle: () => of('payload') } as CallHandler;

    await expect(
      firstValueFrom(interceptor.intercept(context, next)),
    ).resolves.toBe('payload');
  });

  it('should default missing user-agent and content-length', async () => {
    request.get.mockReturnValue(undefined);
    response.get.mockReturnValue(undefined);
    const next = { handle: () => of('ok') } as CallHandler;

    await expect(
      firstValueFrom(interceptor.intercept(context, next)),
    ).resolves.toBe('ok');
  });

  it('should log debug timing on error and rethrow', async () => {
    const err = new Error('failed');
    const next = { handle: () => throwError(() => err) } as CallHandler;

    await expect(
      firstValueFrom(interceptor.intercept(context, next)),
    ).rejects.toBe(err);
  });
});
