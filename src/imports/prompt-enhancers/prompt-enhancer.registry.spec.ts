import { BadRequestException } from '@nestjs/common';
import {
  MULTI_CORRECT_STATEMENTS_ENHANCER_ID,
  SHARED_PASSAGE_ENHANCER_ID,
} from './prompt-enhancer.ids';
import { PromptEnhancerRegistry } from './prompt-enhancer.registry';

describe('PromptEnhancerRegistry', () => {
  const registry = new PromptEnhancerRegistry();

  it('lists registered enhancers including shared-passage and multi-correct-statements', () => {
    const listed = registry.list();
    expect(listed).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: SHARED_PASSAGE_ENHANCER_ID,
          label: 'Shared passage (multiple questions)',
        }),
        expect.objectContaining({
          id: MULTI_CORRECT_STATEMENTS_ENHANCER_ID,
          label: 'More than one correct (statement MCQ)',
        }),
      ]),
    );
  });

  it('resolves empty or undefined ids to an empty list', () => {
    expect(registry.resolve(undefined)).toEqual([]);
    expect(registry.resolve(null)).toEqual([]);
    expect(registry.resolve([])).toEqual([]);
  });

  it('resolves known ids and deduplicates', () => {
    const resolved = registry.resolve([
      SHARED_PASSAGE_ENHANCER_ID,
      SHARED_PASSAGE_ENHANCER_ID,
      '  ',
    ]);
    expect(resolved).toHaveLength(1);
    expect(resolved[0].id).toBe(SHARED_PASSAGE_ENHANCER_ID);
  });

  it('rejects unknown ids', () => {
    expect(() => registry.resolve(['not-a-real-enhancer'])).toThrow(
      BadRequestException,
    );
  });
});
