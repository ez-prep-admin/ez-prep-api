import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class CheckoutThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const userId = req.user?.id;
    if (typeof userId === 'string' && userId.length > 0) {
      return `user:${userId}`;
    }
    return req.ip;
  }
}
