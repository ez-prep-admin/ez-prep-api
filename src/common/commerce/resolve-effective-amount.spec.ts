import { resolveEffectiveAmount } from './resolve-effective-amount';

describe('resolveEffectiveAmount', () => {
  const listAmount = 99900;
  const saleAmount = 79900;

  it('returns listAmount when saleAmount is missing', () => {
    expect(
      resolveEffectiveAmount(
        { listAmount },
        new Date('2026-06-15T12:00:00.000Z'),
      ),
    ).toBe(listAmount);
  });

  it('returns listAmount before sale window', () => {
    expect(
      resolveEffectiveAmount(
        {
          listAmount,
          saleAmount,
          saleValidFrom: new Date('2026-06-01T00:00:00.000Z'),
          saleValidUntil: new Date('2026-06-30T23:59:59.999Z'),
        },
        new Date('2026-05-31T23:59:59.000Z'),
      ),
    ).toBe(listAmount);
  });

  it('returns saleAmount during sale window', () => {
    expect(
      resolveEffectiveAmount(
        {
          listAmount,
          saleAmount,
          saleValidFrom: new Date('2026-06-01T00:00:00.000Z'),
          saleValidUntil: new Date('2026-06-30T23:59:59.999Z'),
        },
        new Date('2026-06-15T12:00:00.000Z'),
      ),
    ).toBe(saleAmount);
  });

  it('returns listAmount after sale window', () => {
    expect(
      resolveEffectiveAmount(
        {
          listAmount,
          saleAmount,
          saleValidFrom: new Date('2026-06-01T00:00:00.000Z'),
          saleValidUntil: new Date('2026-06-30T23:59:59.999Z'),
        },
        new Date('2026-07-01T00:00:00.000Z'),
      ),
    ).toBe(listAmount);
  });

  it('returns saleAmount when amount set and no window bounds', () => {
    expect(
      resolveEffectiveAmount(
        { listAmount, saleAmount },
        new Date('2026-01-01T00:00:00.000Z'),
      ),
    ).toBe(saleAmount);
  });
});
