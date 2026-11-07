import { BATCH_QUESTION_EXTRACTION_SYSTEM_PROMPT } from '../prompt/question.prompt';
import { SHARED_PASSAGE_ENHANCER_ID } from './prompt-enhancer.ids';
import { PromptEnhancerComposer } from './prompt-enhancer.composer';
import { PromptEnhancerRegistry } from './prompt-enhancer.registry';
import { SHARED_PASSAGE_ENRICH_SYSTEM_ADDON } from './shared-passage.enhancer';

describe('PromptEnhancerComposer', () => {
  const composer = new PromptEnhancerComposer(new PromptEnhancerRegistry());

  it('returns the base enrich system prompt unchanged when no enhancers are selected', () => {
    expect(
      composer.composeEnrichSystemPrompt(
        BATCH_QUESTION_EXTRACTION_SYSTEM_PROMPT,
        [],
      ),
    ).toBe(BATCH_QUESTION_EXTRACTION_SYSTEM_PROMPT);
    expect(
      composer.composeEnrichSystemPrompt(
        BATCH_QUESTION_EXTRACTION_SYSTEM_PROMPT,
        undefined,
      ),
    ).toBe(BATCH_QUESTION_EXTRACTION_SYSTEM_PROMPT);
  });

  it('appends the shared-passage addon after the base system prompt', () => {
    const composed = composer.composeEnrichSystemPrompt(
      BATCH_QUESTION_EXTRACTION_SYSTEM_PROMPT,
      [SHARED_PASSAGE_ENHANCER_ID],
    );

    expect(composed.startsWith(BATCH_QUESTION_EXTRACTION_SYSTEM_PROMPT)).toBe(
      true,
    );
    expect(composed).toContain(SHARED_PASSAGE_ENRICH_SYSTEM_ADDON);
    expect(composed).toContain(`Prompt enhancer: ${SHARED_PASSAGE_ENHANCER_ID}`);
    expect(composed).toContain(
      'set questionText to: the complete shared passage',
    );
    expect(composed).toContain('WRONG questionText for Q1');
    expect(composed).toContain('CORRECT questionText for Q1');
    expect(composed).toContain(
      'In which year did the Indian Railways begin its journey',
    );
  });

  it('returns the base user prompt unchanged when enhancers have no user addons', () => {
    const base = 'USER PROMPT';
    expect(
      composer.composeEnrichUserPrompt(base, [SHARED_PASSAGE_ENHANCER_ID]),
    ).toBe(base);
  });

  it('leaves matched questions unchanged when enhancers have no prepare hook', () => {
    const matched = [{ number: 1, question: 'Q1', solution: 'S1' }];
    expect(
      composer.prepareMatchedQuestions(matched, [SHARED_PASSAGE_ENHANCER_ID]),
    ).toBe(matched);
  });

  it('resolves shared-passage max questions per enrich chunk and ignores empty selection', () => {
    expect(composer.resolveMaxQuestionsPerEnrichChunk([])).toBeUndefined();
    expect(
      composer.resolveMaxQuestionsPerEnrichChunk([SHARED_PASSAGE_ENHANCER_ID]),
    ).toBe(5);
  });
});
