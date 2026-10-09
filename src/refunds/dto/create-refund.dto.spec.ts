import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { CreateRefundDto } from './create-refund.dto';

const pipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  transformOptions: { enableImplicitConversion: true },
});

async function parse(body: Record<string, unknown>) {
  return pipe.transform(body, {
    type: 'body',
    metatype: CreateRefundDto,
  });
}

describe('CreateRefundDto', () => {
  it('accepts a reason and trims it', async () => {
    await expect(
      parse({ reason: '  customer request  ' }),
    ).resolves.toMatchObject({ reason: 'customer request' });
  });

  it('rejects a client amount', async () => {
    await expect(
      parse({ reason: 'customer request', amount: 99900 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an empty reason', async () => {
    await expect(parse({ reason: '   ' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
