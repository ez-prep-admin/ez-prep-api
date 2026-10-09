import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { CreateCheckoutOrderDto } from './create-checkout-order.dto';

const pipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  transformOptions: { enableImplicitConversion: true },
});

const offerId = '507f1f77bcf86cd799439011';

function billing() {
  return {
    name: 'Asha Nair',
    stateCode: '32',
    addressLine1: '12 Marine Drive',
    addressLine2: null,
    city: 'Kochi',
    pincode: '682001',
  };
}

async function parse(body: Record<string, unknown>) {
  return pipe.transform(body, {
    type: 'body',
    metatype: CreateCheckoutOrderDto,
  });
}

describe('CreateCheckoutOrderDto', () => {
  it('accepts offer, billing address, and an idempotency key', async () => {
    const dto = await parse({
      offerId,
      billing: billing(),
      idempotencyKey: 'key-1',
    });
    expect(dto).toMatchObject({
      offerId,
      idempotencyKey: 'key-1',
      billing: expect.objectContaining({
        name: 'Asha Nair',
        stateCode: '32',
        addressLine1: '12 Marine Drive',
        city: 'Kochi',
        pincode: '682001',
      }),
    });
  });

  it('rejects a client-supplied amount', async () => {
    await expect(
      parse({
        offerId,
        billing: billing(),
        idempotencyKey: 'key-1',
        amount: 1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects billing that omits the address', async () => {
    const incomplete = billing();
    delete incomplete.addressLine1;
    await expect(
      parse({
        offerId,
        billing: incomplete,
        idempotencyKey: 'key-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
