export type JsonSalvageStrategy =
  | 'direct'
  | 'fences-stripped'
  | 'object-extracted';

export interface JsonSalvageResult {
  parsed: unknown;
  strategy: JsonSalvageStrategy;
}

/**
 * Attempts to parse model output as JSON, trying common LLM formatting fixes.
 */
export function salvageJson(raw: string): JsonSalvageResult {
  const trimmed = raw.trim();
  const candidates: Array<{ strategy: JsonSalvageStrategy; value: string }> = [
    { strategy: 'direct', value: trimmed },
  ];

  const fenceStripped = stripMarkdownFences(trimmed);
  if (fenceStripped !== trimmed) {
    candidates.push({ strategy: 'fences-stripped', value: fenceStripped });
  }

  const extracted = extractJsonObject(fenceStripped);
  if (extracted && extracted !== fenceStripped) {
    candidates.push({ strategy: 'object-extracted', value: extracted });
  }

  let lastError: SyntaxError | undefined;

  for (const candidate of candidates) {
    try {
      return {
        parsed: JSON.parse(candidate.value),
        strategy: candidate.strategy,
      };
    } catch (error) {
      if (error instanceof SyntaxError) {
        lastError = error;
      }
    }
  }

  const trailingCommaFixed = removeTrailingCommas(fenceStripped);
  if (trailingCommaFixed !== fenceStripped) {
    try {
      return {
        parsed: JSON.parse(trailingCommaFixed),
        strategy: 'object-extracted',
      };
    } catch (error) {
      if (error instanceof SyntaxError) {
        lastError = error;
      }
    }
  }

  throw lastError ?? new SyntaxError('Model response is not valid JSON.');
}

export function jsonPreview(raw: string, maxLength = 300): string {
  const compact = raw.replace(/\s+/g, ' ').trim();
  if (compact.length <= maxLength) {
    return compact;
  }

  return `${compact.slice(0, maxLength)}…`;
}

function stripMarkdownFences(value: string): string {
  const match = value.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1].trim() : value;
}

function extractJsonObject(value: string): string | undefined {
  const start = value.indexOf('{');
  const end = value.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    return undefined;
  }

  return value.slice(start, end + 1);
}

/** Removes trailing commas before `}` or `]` — a common LLM JSON mistake. */
function removeTrailingCommas(value: string): string {
  return value.replace(/,\s*([}\]])/g, '$1');
}
