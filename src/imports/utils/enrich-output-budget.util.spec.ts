import { isOutputBudgetExhaustionError } from './enrich-output-budget.util';

describe('isOutputBudgetExhaustionError', () => {
  it('detects truncated JSON from finish_reason=length', () => {
    expect(
      isOutputBudgetExhaustionError(
        'Model batch response was truncated before valid JSON could be produced.',
      ),
    ).toBe(true);
  });

  it('detects empty batch responses when thinking consumes the budget', () => {
    expect(
      isOutputBudgetExhaustionError(
        'DeepSeek returned an empty batch response for questions [103, 104].',
      ),
    ).toBe(true);
  });

  it('ignores unrelated enrich failures', () => {
    expect(
      isOutputBudgetExhaustionError('Business validation failed: need 4 options'),
    ).toBe(false);
  });
});
