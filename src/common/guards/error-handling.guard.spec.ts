import { ExecutionContext } from '@nestjs/common';
import { ErrorHandlingGuard } from './error-handling.guard';

describe('ErrorHandlingGuard', () => {
  it('should always allow access', async () => {
    const guard = new ErrorHandlingGuard();
    const context = {} as ExecutionContext;

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
});
