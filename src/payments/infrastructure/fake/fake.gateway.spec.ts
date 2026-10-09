import { FakeGateway } from './fake.gateway';

describe('FakeGateway', () => {
  const gateway = new FakeGateway();

  it('rejects totals under 100 paise', async () => {
    await expect(
      gateway.createOrder({
        orderId: 'abc',
        amount: 50,
        currency: 'INR',
        receipt: 'ORD-1',
      }),
    ).rejects.toThrow(/100 paise/);
  });

  it('creates a fake provider order id', async () => {
    await expect(
      gateway.createOrder({
        orderId: 'abc',
        amount: 99900,
        currency: 'INR',
        receipt: 'ORD-1',
      }),
    ).resolves.toMatchObject({
      providerOrderId: 'fake_abc',
      providerData: { fakeOrderId: 'fake_abc', amount: 99900, currency: 'INR' },
    });
  });
});
