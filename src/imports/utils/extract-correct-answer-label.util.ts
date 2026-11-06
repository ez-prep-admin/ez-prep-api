const OPTION_LABELS = ['a', 'b', 'c', 'd'] as const;

export type OptionLabel = (typeof OPTION_LABELS)[number];

function asOptionLabel(value: string | undefined): OptionLabel | null {
  if (!value) return null;
  const label = value.toLowerCase() as OptionLabel;
  return OPTION_LABELS.includes(label) ? label : null;
}

/**
 * Pull the answer letter from a solution / answer-key block when the source
 * states it explicitly. Used to override LLM bias that collapses every
 * correctAnswer onto "a".
 */
export function extractCorrectAnswerLabel(
  solution?: string | null,
): OptionLabel | null {
  if (!solution?.trim()) {
    return null;
  }

  const text = solution.trim();

  const patterns: RegExp[] = [
    // Sol.48.(d) … / Sol.1.(a)
    /\bSol\.\s*\d+\s*\.\s*\(([a-d])\)/i,
    // Answer: (c) / Ans. c / Correct answer: b
    /\b(?:Ans(?:wer)?|Correct(?:\s+answer)?)\s*[:.\-]?\s*\(?([a-d])\)?\b/i,
    // Correct option is (c) / option (c) is correct
    /\bcorrect\s+(?:option|answer)\s+is\s*\(?([a-d])\)?/i,
    /\boption\s*\(([a-d])\)\s+is\s+correct\b/i,
    // Short key line at the top: "(c)" or "1. (b)"
    /^(?:\d+\.\s*)?\(([a-d])\)(?:\s|$|[.:,])/im,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const label = asOptionLabel(match?.[1]);
    if (label) {
      return label;
    }
  }

  return null;
}

/**
 * Prefer an explicit solution letter over the model label when they disagree.
 */
export function resolveCorrectAnswerLabel(
  modelLabel: string,
  solution?: string | null,
): {
  label: OptionLabel;
  overridden: boolean;
  sourceLabel: OptionLabel | null;
} {
  const normalizedModel = asOptionLabel(modelLabel) ?? 'a';
  const sourceLabel = extractCorrectAnswerLabel(solution);

  if (sourceLabel && sourceLabel !== normalizedModel) {
    return { label: sourceLabel, overridden: true, sourceLabel };
  }

  return {
    label: sourceLabel ?? normalizedModel,
    overridden: false,
    sourceLabel,
  };
}
