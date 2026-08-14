import { ExecutionContext } from '@nestjs/common';
import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard';

describe('OptionalJwtAuthGuard', () => {
  const guard = new OptionalJwtAuthGuard();

  const context = (authorization?: string): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ headers: { authorization } }),
      }),
    }) as ExecutionContext;

  it('allows requests without Authorization', () => {
    expect(guard.canActivate(context())).toBe(true);
  });

  it('delegates to passport when Authorization is present', () => {
    const superActivate = jest
      .spyOn(
        Object.getPrototypeOf(OptionalJwtAuthGuard.prototype),
        'canActivate',
      )
      .mockReturnValue(true);
    expect(guard.canActivate(context('Bearer tok'))).toBe(true);
    expect(superActivate).toHaveBeenCalled();
    superActivate.mockRestore();
  });

  it('handleRequest throws errors and returns user or null', () => {
    expect(() =>
      guard.handleRequest(new Error('bad'), null as never),
    ).toThrow('bad');
    expect(guard.handleRequest(null, { id: '1' })).toEqual({ id: '1' });
    expect(guard.handleRequest(null, null as never)).toBeNull();
  });
});
