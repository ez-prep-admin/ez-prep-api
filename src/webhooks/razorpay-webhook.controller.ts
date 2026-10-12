import {
  BadRequestException,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  RawBodyRequest,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Request } from 'express';
import { CommerceEnabledGuard } from '../commerce/commerce-enabled.guard';
import { RazorpayWebhookService } from './razorpay-webhook.service';

@ApiTags('webhooks')
@SkipThrottle()
@Controller('webhooks/payments')
@UseGuards(CommerceEnabledGuard)
export class RazorpayWebhookController {
  constructor(private readonly webhooks: RazorpayWebhookService) {}

  @Post('razorpay')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Razorpay webhook',
    description:
      'Server-to-server. Verifies X-Razorpay-Signature. No user JWT. ' +
      'A duplicate event returns 200 and does not change the order again.',
  })
  @ApiOkResponse({ description: 'Event accepted' })
  async receive(@Req() req: RawBodyRequest<Request>) {
    const rawBody = req.rawBody;
    if (!rawBody?.length) {
      throw new BadRequestException('Missing webhook body');
    }
    const data = await this.webhooks.handle({
      rawBody,
      headers: req.headers,
    });
    return { message: 'Webhook received', data };
  }
}
