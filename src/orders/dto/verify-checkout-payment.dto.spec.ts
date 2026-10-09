import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { VerifyCheckoutPaymentDto } from './verify-checkout-payment.dto';

const pipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  transformOptions: { enableImplicitConversion: true },
});

async function parse(body: Record<string, unknown>) {
  return pipe.transform(body, {
    type: 'body',
    metatype: VerifyCheckoutPaymentDto,
  });
}

describe('VerifyCheckoutPaymentDto', () => {
  it('requires the three Razorpay fields when provider is razorpay', async () => {
    await expect(
      parse({
        provider: 'razorpay',
        providerPayload: { razorpay_order_id: 'order_1' },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    const dto = await parse({
      provider: 'razorpay',
      providerPayload: {
        razorpay_order_id: 'order_1',
        razorpay_payment_id: 'pay_1',
        razorpay_signature: 'sig',
      },
    });
    expect(dto.provider).toBe('razorpay');
  });

  it('accepts a fake payload without Razorpay fields', async () => {
    const dto = await parse({
      provider: 'fake',
      providerPayload: { fakePaymentId: 'pay_test_1' },
    });
    expect(dto.providerPayload).toEqual({ fakePaymentId: 'pay_test_1' });
  });
});
