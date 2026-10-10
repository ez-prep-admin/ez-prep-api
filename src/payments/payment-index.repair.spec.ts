import { PaymentRole } from './domain/payment-role.enum';
import { PaymentSchema } from './schemas/payment.schema';
import {
  legacyProviderPaymentIndexNames,
  PRIMARY_PAYMENT_INDEX,
  PROVIDER_PAYMENT_INDEX,
} from './payment-index.repair';

describe('payment providerPaymentId index', () => {
  it('is unique only when a payment id is present', () => {
    const index = PaymentSchema.indexes().find(
      ([fields]) => fields.provider === 1 && fields.providerPaymentId === 1,
    );

    expect(index?.[1]).toMatchObject({
      unique: true,
      name: PROVIDER_PAYMENT_INDEX,
      partialFilterExpression: {
        providerPaymentId: { $type: 'string', $gt: '' },
      },
    });
    expect(index?.[1]).not.toHaveProperty('sparse');
  });

  it('keeps one PRIMARY payment per order', () => {
    const index = PaymentSchema.indexes().find(
      ([, options]) => options.name === PRIMARY_PAYMENT_INDEX,
    );

    expect(index?.[0]).toEqual({ orderId: 1 });
    expect(index?.[1]).toMatchObject({
      unique: true,
      partialFilterExpression: { role: PaymentRole.PRIMARY },
    });
  });

  it('drops sparse indexes on the same keys and keeps the partial one', () => {
    expect(
      legacyProviderPaymentIndexNames([
        {
          name: 'provider_1_providerPaymentId_1',
          key: { provider: 1, providerPaymentId: 1 },
        },
        {
          name: PROVIDER_PAYMENT_INDEX,
          key: { provider: 1, providerPaymentId: 1 },
          partialFilterExpression: { providerPaymentId: { $gt: '' } },
        },
        { name: 'orderId_1', key: { orderId: 1 } },
      ]),
    ).toEqual(['provider_1_providerPaymentId_1']);
  });
});
