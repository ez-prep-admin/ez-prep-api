import {
  DocumentContentProfile,
  ReasoningEffort,
} from '../types/document-structure';

export const DEFAULT_CONTENT_PROFILE: DocumentContentProfile = {
  requiresReasoning: false,
  reasoningDomains: [],
  confidence: 0,
};

/** Upload subjects that benefit from DeepSeek thinking during enrichment. */
export const STEM_SUBJECT_KEYWORDS = [
  'physics',
  'chemistry',
  'biology',
  'botany',
  'zoology',
  'mathematics',
  'maths',
  'math',
  'quantitative aptitude',
  'quantitative',
  'numerical ability',
  'general intelligence',
  'reasoning',
  'science',
  'engineering',
] as const;

/** Upload subjects that should never use thinking mode. */
export const NON_STEM_SUBJECT_KEYWORDS = [
  'english',
  'history',
  'geography',
  'hindi',
  'tamil',
  'telugu',
  'literature',
  'language',
  'vocabulary',
  'grammar',
  'civics',
  'polity',
  'economics',
] as const;

export const STEM_DOMAIN_KEYWORDS = [
  'physics',
  'chemistry',
  'biology',
  'botany',
  'zoology',
  'mathematics',
  'maths',
  'math',
  'quantitative',
  'numerical',
  'calculus',
  'mechanics',
  'thermodynamics',
  'organic chemistry',
  'inorganic chemistry',
  'biochemistry',
  'geometry',
  'algebra',
  'trigonometry',
  'intelligence',
  'aptitude',
] as const;

export const NON_STEM_DOMAIN_KEYWORDS = [
  'english',
  'reading comprehension',
  'comprehension',
  'vocabulary',
  'grammar',
  'literature',
  'history',
  'geography',
  'language',
  'synonym',
  'antonym',
  'passage',
] as const;

export function normalizeReasoningEffort(
  value: unknown,
): ReasoningEffort | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.toLowerCase().trim();

  if (
    normalized === 'low' ||
    normalized === 'medium' ||
    normalized === 'high'
  ) {
    return normalized;
  }

  if (
    normalized.includes('high') ||
    normalized.includes('heavy') ||
    normalized.includes('complex')
  ) {
    return 'high';
  }

  if (normalized.includes('med')) {
    return 'medium';
  }

  if (
    normalized.includes('low') ||
    normalized.includes('light') ||
    normalized.includes('none') ||
    normalized.includes('n/a')
  ) {
    return undefined;
  }

  return undefined;
}

export function normalizeContentProfileFromLlm(
  value: unknown,
): DocumentContentProfile {
  if (!value || typeof value !== 'object') {
    return { ...DEFAULT_CONTENT_PROFILE };
  }

  const raw = value as Record<string, unknown>;
  const requiresReasoning = Boolean(raw.requiresReasoning);
  const reasoningDomains = Array.isArray(raw.reasoningDomains)
    ? raw.reasoningDomains.filter(
        (domain): domain is string => typeof domain === 'string',
      )
    : [];
  const detectedSubjects = Array.isArray(raw.detectedSubjects)
    ? raw.detectedSubjects.filter(
        (subject): subject is string => typeof subject === 'string',
      )
    : undefined;
  const confidence = Number(raw.confidence);
  const reasoningEffort = requiresReasoning
    ? (normalizeReasoningEffort(raw.reasoningEffort) ?? 'high')
    : undefined;

  return {
    requiresReasoning,
    reasoningDomains,
    reasoningEffort,
    detectedSubjects,
    confidence: Number.isFinite(confidence)
      ? Math.min(1, Math.max(0, confidence))
      : 0,
    rationale:
      typeof raw.rationale === 'string' && raw.rationale.trim().length > 0
        ? raw.rationale.trim()
        : undefined,
  };
}

function matchesKeywordList(
  value: string,
  keywords: readonly string[],
): boolean {
  const normalized = value.toLowerCase().trim();
  return keywords.some(keyword => normalized.includes(keyword));
}

export function matchesStemSubjectName(subjectName: string): boolean {
  return matchesKeywordList(subjectName, STEM_SUBJECT_KEYWORDS);
}

export function matchesNonStemSubjectName(subjectName: string): boolean {
  return matchesKeywordList(subjectName, NON_STEM_SUBJECT_KEYWORDS);
}

export function matchesStemDomains(domains: string[]): boolean {
  return domains.some(domain =>
    matchesKeywordList(domain, STEM_DOMAIN_KEYWORDS),
  );
}

export function matchesNonStemDomains(domains: string[]): boolean {
  return domains.some(domain =>
    matchesKeywordList(domain, NON_STEM_DOMAIN_KEYWORDS),
  );
}
