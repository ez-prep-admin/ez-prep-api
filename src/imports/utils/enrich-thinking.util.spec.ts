import {
  formatEnrichThinkingLog,
  matchesReasoningSubjectName,
  resolveEnrichThinking,
} from './enrich-thinking.util';
import { DocumentStructure } from '../types/document-structure';

const baseStructure = (): DocumentStructure => ({
  questionPattern: {
    type: 'numbered',
    regex: '^(\\d+)\\.\\s',
    exampleMatch: '1. Sample',
  },
  solutionPattern: {
    location: 'separate',
    matchesQuestionNumbering: true,
  },
  delimiter: { type: 'blank-line', value: '', confidence: 1 },
  metadata: {
    hasDifficulty: false,
    hasMarks: false,
    hasSubjectLabels: false,
  },
  detectedFormat: 'Test',
  confidence: 0.9,
});

describe('enrich-thinking.util', () => {
  it('enables thinking for stem content profiles', () => {
    const resolved = resolveEnrichThinking({
      documentStructure: {
        ...baseStructure(),
        contentProfile: {
          requiresReasoning: true,
          reasoningDomains: ['physics'],
          reasoningEffort: 'high',
          confidence: 0.92,
          rationale: 'Numerical physics problems in sample.',
        },
      },
    });

    expect(resolved.thinking).toEqual({
      enabled: true,
      reasoningEffort: 'high',
    });
    expect(resolved.decision.source).toBe('contentProfile');
  });

  it('disables thinking for english upload subjects even with mixed profile', () => {
    const resolved = resolveEnrichThinking({
      documentStructure: {
        ...baseStructure(),
        contentProfile: {
          requiresReasoning: true,
          reasoningDomains: ['english'],
          confidence: 0.9,
        },
      },
      subjectName: 'English',
    });

    expect(resolved.thinking).toBeUndefined();
    expect(resolved.decision.enabled).toBe(false);
  });

  it('disables thinking for english content domains', () => {
    const resolved = resolveEnrichThinking({
      documentStructure: {
        ...baseStructure(),
        contentProfile: {
          requiresReasoning: false,
          reasoningDomains: ['english', 'reading comprehension'],
          confidence: 0.9,
          rationale: 'Passage and vocabulary recall.',
        },
      },
    });

    expect(resolved.thinking).toBeUndefined();
    expect(resolved.decision.enabled).toBe(false);
  });

  it('falls back to stem upload subject when profile is missing', () => {
    const resolved = resolveEnrichThinking({
      subjectName: 'Mathematics',
    });

    expect(resolved.thinking).toEqual({
      enabled: true,
      reasoningEffort: 'high',
    });
    expect(resolved.decision.source).toBe('uploadSubject');
  });

  it('matches known stem subject names', () => {
    expect(matchesReasoningSubjectName('Quantitative Aptitude')).toBe(true);
    expect(matchesReasoningSubjectName('Physics')).toBe(true);
    expect(matchesReasoningSubjectName('English')).toBe(false);
  });

  it('formats enabled and disabled log lines', () => {
    expect(
      formatEnrichThinkingLog({
        enabled: true,
        effort: 'high',
        source: 'contentProfile',
        reasoningDomains: ['physics'],
        confidence: 0.9,
        rationale: 'Calculation-heavy sample.',
      }),
    ).toContain('Thinking mode ENABLED');

    expect(
      formatEnrichThinkingLog({
        enabled: false,
        source: 'disabled',
        reasoningDomains: ['english'],
        confidence: 0.88,
      }),
    ).toContain('Thinking mode DISABLED');
  });
});
