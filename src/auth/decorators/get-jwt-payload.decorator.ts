import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { JwtPayload } from '../auth.service';
import { JWT_PAYLOAD_REQUEST_KEY } from '../strategies/jwt.strategy';

export const GetJwtPayload = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload | undefined => {
    const req = ctx
      .switchToHttp()
      .getRequest<Request & { [JWT_PAYLOAD_REQUEST_KEY]?: JwtPayload }>();
    return req[JWT_PAYLOAD_REQUEST_KEY];
  },
);
