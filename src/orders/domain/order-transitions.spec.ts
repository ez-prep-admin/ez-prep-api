import { OrderStatus } from '../../common/enums/order-status.enum';
import {
  IllegalOrderTransitionError,
  assertOrderTransition,
} from './order-transitions';

describe('order transitions', () => {
  it('allows CREATED to PENDING_PAYMENT and PENDING_PAYMENT to PAID', () => {
    expect(
      assertOrderTransition(OrderStatus.CREATED, OrderStatus.PENDING_PAYMENT),
    ).toBe('apply');
    expect(
      assertOrderTransition(OrderStatus.PENDING_PAYMENT, OrderStatus.PAID),
    ).toBe('apply');
  });

  it('throws on an illegal status transition', () => {
    expect(() =>
      assertOrderTransition(OrderStatus.CREATED, OrderStatus.PAID),
    ).toThrow(IllegalOrderTransitionError);
    expect(() =>
      assertOrderTransition(OrderStatus.CANCELLED, OrderStatus.PAID),
    ).toThrow(IllegalOrderTransitionError);
  });

  it('allows PAID to REFUNDED', () => {
    expect(assertOrderTransition(OrderStatus.PAID, OrderStatus.REFUNDED)).toBe(
      'apply',
    );
  });

  it('allows a late capture from EXPIRED or FAILED', () => {
    expect(assertOrderTransition(OrderStatus.EXPIRED, OrderStatus.PAID)).toBe(
      'apply',
    );
    expect(assertOrderTransition(OrderStatus.FAILED, OrderStatus.PAID)).toBe(
      'apply',
    );
  });

  it('treats a second PAID signal as a no-op', () => {
    expect(assertOrderTransition(OrderStatus.PAID, OrderStatus.PAID)).toBe(
      'noop',
    );
  });
});
