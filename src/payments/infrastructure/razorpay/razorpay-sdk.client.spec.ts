import {
  razorpayErrorDescription,
  refundFailureMessage,
} from './razorpay-sdk.client';

describe('Razorpay refund failure text', () => {
  it('reads the provider description', () => {
    expect(
      razorpayErrorDescription({
        statusCode: 400,
        error: { description: ' invalid request sent ' },
      }),
    ).toBe('invalid request sent');
    expect(razorpayErrorDescription(new Error('down'))).toBeUndefined();
  });

  it('explains a test-mode refund that the balance cannot cover', () => {
    expect(refundFailureMessage('invalid request sent', 12900, 12642)).toBe(
      'Razorpay could not refund this payment because the account balance is lower than the refund. Capture another test payment, then try again.',
    );
  });

  it('keeps other provider descriptions', () => {
    expect(
      refundFailureMessage(
        'The payment status should be captured',
        12900,
        null,
      ),
    ).toBe(
      'Razorpay could not refund this payment: The payment status should be captured',
    );
    expect(refundFailureMessage(undefined, 12900, null)).toBe(
      'Payment provider request failed',
    );
  });
});
