import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { GetUser } from './get-user.decorator';

describe('GetUser', () => {
  it('should return request.user from the HTTP context', () => {
    class TestController {
      handler(@GetUser() user: unknown) {
        return user;
      }
    }

    const metadata = Reflect.getMetadata(
      ROUTE_ARGS_METADATA,
      TestController,
      'handler',
    );
    const key = Object.keys(metadata)[0];
    const factory = metadata[key].factory;
    const user = { id: '1', email: 'a@b.com' };
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    };

    expect(factory(undefined, ctx)).toEqual(user);
  });
});
