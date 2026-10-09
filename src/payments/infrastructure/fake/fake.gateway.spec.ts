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

  it('refunds the full amount as processed', async () => {
    await expect(
      gateway.refund({
        providerPaymentId: 'pay_1',
        amount: 99900,
        currency: 'INR',
      }),
    ).resolves.toEqual({
      providerRefundId: 'fake_rfnd_pay_1',
      status: 'processed',
      amount: 99900,
    });
  });

  it('maps a staged fetch to captured, failed, or ignored', async () => {
    gateway.stageOrderStatus('fake_paid', {
      status: 'CAPTURED',
      providerPaymentId: 'pay_1',
      amount: 99900,
      currency: 'INR',
    });
    gateway.stageOrderStatus('fake_failed', { status: 'FAILED' });

    await expect(gateway.fetchOrderStatus('fake_paid')).resolves.toMatchObject({
      status: 'CAPTURED',
      providerPaymentId: 'pay_1',
      amount: 99900,
      currency: 'INR',
      providerOrderId: 'fake_paid',
    });
    await expect(
      gateway.fetchOrderStatus('fake_failed'),
    ).resolves.toMatchObject({
      status: 'FAILED',
      providerOrderId: 'fake_failed',
    });
    await expect(gateway.fetchOrderStatus('fake_open')).resolves.toMatchObject({
      status: 'IGNORED',
      providerOrderId: 'fake_open',
    });
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
