import {
  matchesNonStemSubjectName,
  matchesStemSubjectName,
  normalizeContentProfileFromLlm,
  normalizeReasoningEffort,
} from './content-profile.util';

describe('content-profile.util', () => {
  it('normalizes invalid reasoningEffort values to undefined', () => {
    expect(normalizeReasoningEffort(null)).toBeUndefined();
    expect(normalizeReasoningEffort('none')).toBeUndefined();
    expect(normalizeReasoningEffort('N/A')).toBeUndefined();
    expect(normalizeReasoningEffort('high')).toBe('high');
    expect(normalizeReasoningEffort('MEDIUM')).toBe('medium');
  });

  it('salvages english-style content profiles without reasoning effort', () => {
    const profile = normalizeContentProfileFromLlm({
      requiresReasoning: false,
      reasoningDomains: ['english', 'reading comprehension'],
      reasoningEffort: null,
      confidence: 0.91,
      rationale: 'Vocabulary and passage-based recall.',
    });

    expect(profile.requiresReasoning).toBe(false);
    expect(profile.reasoningEffort).toBeUndefined();
    expect(profile.reasoningDomains).toEqual(['english', 'reading comprehension']);
  });

  it('defaults reasoning effort to high for stem profiles that omit effort', () => {
    const profile = normalizeContentProfileFromLlm({
      requiresReasoning: true,
      reasoningDomains: ['mathematics'],
      confidence: 0.88,
    });

    expect(profile.reasoningEffort).toBe('high');
  });

  it('classifies stem and non-stem upload subjects', () => {
    expect(matchesStemSubjectName('Physics')).toBe(true);
    expect(matchesStemSubjectName('Mathematics')).toBe(true);
    expect(matchesNonStemSubjectName('English')).toBe(true);
    expect(matchesStemSubjectName('English')).toBe(false);
  });
});
