import {
  CallHandler,
  ExecutionContext,
  RequestTimeoutException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of, throwError, TimeoutError, firstValueFrom } from 'rxjs';
import { TimeoutInterceptor } from './timeout.interceptor';
import { SKIP_TIMEOUT_KEY } from '../decorators/skip-timeout.decorator';

describe('TimeoutInterceptor', () => {
  let interceptor: TimeoutInterceptor;
  const reflector = {
    getAllAndOverride: jest.fn(),
  };
  const context = {
    getHandler: jest.fn(),
    getClass: jest.fn(),
  } as unknown as ExecutionContext;

  beforeEach(() => {
    interceptor = new TimeoutInterceptor(reflector as unknown as Reflector);
    jest.clearAllMocks();
  });

  it('should skip timeout when decorator is set', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const handle = jest.fn().mockReturnValue(of('ok'));
    const next = { handle } as CallHandler;

    const result = await firstValueFrom(interceptor.intercept(context, next));

    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(SKIP_TIMEOUT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    expect(result).toBe('ok');
  });

  it('should pass through successful responses', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const next = { handle: () => of({ id: 1 }) } as CallHandler;

    await expect(
      firstValueFrom(interceptor.intercept(context, next)),
    ).resolves.toEqual({ id: 1 });
  });

  it('should map TimeoutError to RequestTimeoutException', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const next = {
      handle: () => throwError(() => new TimeoutError()),
    } as CallHandler;

    await expect(
      firstValueFrom(interceptor.intercept(context, next)),
    ).rejects.toBeInstanceOf(RequestTimeoutException);
  });

  it('should rethrow non-timeout errors', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const err = new Error('boom');
    const next = { handle: () => throwError(() => err) } as CallHandler;

    await expect(
      firstValueFrom(interceptor.intercept(context, next)),
    ).rejects.toBe(err);
  });
});
