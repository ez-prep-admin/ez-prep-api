import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Authenticates when a Bearer token is present; allows anonymous when it is not.
 * Invalid/expired tokens still fail. Used for bootstrap-or-admin create-admin.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
    }>();
    if (!request.headers.authorization) {
      return true;
    }
    return super.canActivate(context);
  }

  handleRequest<TUser>(err: Error | null, user: TUser): TUser | null {
    if (err) {
      throw err;
    }
    return user ?? null;
  }
}
