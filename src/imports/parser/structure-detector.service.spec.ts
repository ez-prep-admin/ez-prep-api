import { normalizeDocumentStructure } from './document-structure.normalizer';
import { DocumentStructure } from '../types/document-structure';

describe('normalizeDocumentStructure', () => {
  it('adds a capture group to Q-heading regex patterns', () => {
    const normalized = normalizeDocumentStructure('', {
      questionPattern: {
        type: 'numbered',
        regex: '^## Q\\d+\\.\\s',
        exampleMatch: '## Q1. JEE Main 2026',
      },
      solutionPattern: {
        location: 'separate',
        matchesQuestionNumbering: true,
      },
      delimiter: { type: 'heading', value: '## Q', confidence: 1 },
      metadata: {
        hasDifficulty: false,
        hasMarks: false,
        hasSubjectLabels: true,
      },
      detectedFormat: 'JEE Main',
      confidence: 0.95,
    });

    expect(normalized.questionPattern.regex).toBe('^## Q(\\d+)\\.\\s');
    expect(normalized.questionPattern.type).toBe('labeled');
  });
});
