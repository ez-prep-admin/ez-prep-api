import { INDIAN_STATES, indianStateByCode } from './indian-states';

describe('indian states', () => {
  it('resolves Kerala from GST code 32', () => {
    expect(indianStateByCode('32')).toEqual({ code: '32', name: 'Kerala' });
  });

  it('rejects unknown and legacy codes', () => {
    expect(indianStateByCode('99')).toBeUndefined();
    expect(indianStateByCode('25')).toBeUndefined();
    expect(indianStateByCode('28')).toBeUndefined();
  });

  it('keeps unique two-digit codes', () => {
    const codes = INDIAN_STATES.map(state => state.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes.every(code => /^\d{2}$/.test(code))).toBe(true);
  });
});
