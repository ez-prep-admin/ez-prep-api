import {
  DocumentContentProfile,
  DocumentStructure,
  ReasoningEffort,
} from '../types/document-structure';
import { DeepseekThinkingOptions } from '../llm/deepseek.types';
import {
  matchesNonStemDomains,
  matchesNonStemSubjectName,
  matchesStemDomains,
  matchesStemSubjectName,
} from './content-profile.util';

export type EnrichThinkingSource =
  | 'contentProfile'
  | 'uploadSubject'
  | 'disabled';

export interface EnrichThinkingDecision {
  enabled: boolean;
  effort?: ReasoningEffort;
  source: EnrichThinkingSource;
  reasoningDomains?: string[];
  confidence?: number;
  rationale?: string;
  subjectName?: string;
}

export interface ResolvedEnrichThinking {
  thinking?: DeepseekThinkingOptions;
  decision: EnrichThinkingDecision;
}

const CONTENT_PROFILE_ENABLE_THRESHOLD = 0.5;
const CONTENT_PROFILE_DISABLE_THRESHOLD = 0.8;

export function normalizeContentProfile(
  profile?: DocumentContentProfile | null,
): DocumentContentProfile | undefined {
  if (!profile) {
    return undefined;
  }

  return {
    requiresReasoning: Boolean(profile.requiresReasoning),
    reasoningDomains: profile.reasoningDomains ?? [],
    reasoningEffort: profile.reasoningEffort,
    detectedSubjects: profile.detectedSubjects,
    confidence: profile.confidence ?? 0,
    rationale: profile.rationale,
  };
}

export function resolveEnrichThinking(options: {
  documentStructure?: DocumentStructure | null;
  subjectName?: string | null;
}): ResolvedEnrichThinking {
  const profile = normalizeContentProfile(
    options.documentStructure?.contentProfile,
  );
  const subjectName = options.subjectName?.trim() || undefined;

  if (subjectName && matchesNonStemSubjectName(subjectName)) {
    return disabledDecision(profile, subjectName, {
      rationale:
        profile?.rationale ??
        `Upload subject "${subjectName}" is non-STEM; thinking mode skipped.`,
    });
  }

  if (
    profile &&
    matchesNonStemDomains(profile.reasoningDomains) &&
    !matchesStemDomains(profile.reasoningDomains) &&
    profile.confidence >= CONTENT_PROFILE_ENABLE_THRESHOLD
  ) {
    return disabledDecision(profile, subjectName, {
      rationale:
        profile.rationale ??
        'Detected non-STEM content domains; thinking mode skipped.',
    });
  }

  if (
    profile?.requiresReasoning &&
    profile.confidence >= CONTENT_PROFILE_ENABLE_THRESHOLD &&
    matchesStemDomains(profile.reasoningDomains)
  ) {
    const effort = profile.reasoningEffort ?? 'high';

    return {
      thinking: { enabled: true, reasoningEffort: effort },
      decision: {
        enabled: true,
        effort,
        source: 'contentProfile',
        reasoningDomains: profile.reasoningDomains,
        confidence: profile.confidence,
        rationale: profile.rationale,
        subjectName,
      },
    };
  }

  if (
    profile &&
    !profile.requiresReasoning &&
    profile.confidence >= CONTENT_PROFILE_DISABLE_THRESHOLD
  ) {
    return disabledDecision(profile, subjectName, {
      rationale: profile.rationale,
    });
  }

  if (subjectName && matchesStemSubjectName(subjectName)) {
    return {
      thinking: { enabled: true, reasoningEffort: 'high' },
      decision: {
        enabled: true,
        effort: 'high',
        source: 'uploadSubject',
        subjectName,
        rationale:
          profile?.rationale ??
          `Upload subject "${subjectName}" is a STEM category.`,
        confidence: profile?.confidence,
        reasoningDomains: profile?.reasoningDomains,
      },
    };
  }

  return disabledDecision(profile, subjectName, {
    rationale:
      profile?.rationale ??
      'No STEM content profile or upload subject detected.',
  });
}

function disabledDecision(
  profile: DocumentContentProfile | undefined,
  subjectName: string | undefined,
  overrides?: { rationale?: string },
): ResolvedEnrichThinking {
  return {
    decision: {
      enabled: false,
      source: 'disabled',
      reasoningDomains: profile?.reasoningDomains,
      confidence: profile?.confidence,
      rationale: overrides?.rationale ?? profile?.rationale,
      subjectName,
    },
  };
}

export function formatEnrichThinkingLog(
  decision: EnrichThinkingDecision,
): string {
  if (decision.enabled) {
    const domains =
      decision.reasoningDomains && decision.reasoningDomains.length > 0
        ? decision.reasoningDomains.join(', ')
        : 'none';

    return (
      `[enrich] Thinking mode ENABLED (effort=${decision.effort ?? 'high'}, ` +
      `source=${decision.source}, domains=[${domains}], ` +
      `confidence=${decision.confidence ?? 'n/a'}` +
      (decision.subjectName ? `, subject="${decision.subjectName}"` : '') +
      (decision.rationale ? `, rationale="${decision.rationale}"` : '') +
      ')'
    );
  }

  const domains =
    decision.reasoningDomains && decision.reasoningDomains.length > 0
      ? decision.reasoningDomains.join(', ')
      : 'none';

  return (
    `[enrich] Thinking mode DISABLED (source=${decision.source}, domains=[${domains}], ` +
    `confidence=${decision.confidence ?? 'n/a'}` +
    (decision.subjectName ? `, subject="${decision.subjectName}"` : '') +
    (decision.rationale ? `, rationale="${decision.rationale}"` : '') +
    ')'
  );
}

// Backwards-compatible exports for tests
export const matchesReasoningSubjectName = matchesStemSubjectName;
