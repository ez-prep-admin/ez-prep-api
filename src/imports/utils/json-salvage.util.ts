export type JsonSalvageStrategy =
  | 'direct'
  | 'fences-stripped'
  | 'object-extracted'
  | 'invalid-escapes-fixed';

export interface JsonSalvageResult {
  parsed: unknown;
  strategy: JsonSalvageStrategy;
}

/**
 * Attempts to parse model output as JSON, trying common LLM formatting fixes.
 */
export function salvageJson(raw: string): JsonSalvageResult {
  const trimmed = raw.trim();
  const fenceStripped = stripMarkdownFences(trimmed);
  const extracted = extractJsonObject(fenceStripped) ?? fenceStripped;

  const candidates: Array<{ strategy: JsonSalvageStrategy; value: string }> = [
    { strategy: 'direct', value: trimmed },
  ];

  if (fenceStripped !== trimmed) {
    candidates.push({ strategy: 'fences-stripped', value: fenceStripped });
  }

  if (extracted !== fenceStripped) {
    candidates.push({ strategy: 'object-extracted', value: extracted });
  }

  const trailingCommaFixed = removeTrailingCommas(extracted);
  if (trailingCommaFixed !== extracted) {
    candidates.push({ strategy: 'object-extracted', value: trailingCommaFixed });
  }

  // LaTeX in JSON strings often uses raw \( \pi \mathrm — invalid JSON escapes.
  const escapeFixed = fixInvalidJsonStringEscapes(trailingCommaFixed);
  if (escapeFixed !== trailingCommaFixed) {
    candidates.push({
      strategy: 'invalid-escapes-fixed',
      value: escapeFixed,
    });
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

  throw lastError ?? new SyntaxError('Model response is not valid JSON.');
}

export function jsonPreview(raw: string, maxLength = 300): string {
  const compact = raw.replace(/\s+/g, ' ').trim();
  if (compact.length <= maxLength) {
    return compact;
  }

  return `${compact.slice(0, maxLength)}…`;
}

/**
 * Within JSON string literals, turn invalid `\` escapes into `\\` so Mathpix
 * LaTeX like `\(` / `\pi` / `\mathrm` can round-trip through JSON.parse.
 */
export function fixInvalidJsonStringEscapes(value: string): string {
  let result = '';
  let inString = false;
  let i = 0;

  while (i < value.length) {
    const ch = value[i];

    if (!inString) {
      if (ch === '"') {
        inString = true;
      }
      result += ch;
      i += 1;
      continue;
    }

    if (ch === '"') {
      inString = false;
      result += ch;
      i += 1;
      continue;
    }

    if (ch !== '\\') {
      result += ch;
      i += 1;
      continue;
    }

    const next = value[i + 1];
    if (next === undefined) {
      result += '\\\\';
      i += 1;
      continue;
    }

    if ('"\\/bfnrt'.includes(next)) {
      result += `\\${next}`;
      i += 2;
      continue;
    }

    if (
      next === 'u' &&
      /^[0-9a-fA-F]{4}/.test(value.slice(i + 2, i + 6))
    ) {
      result += value.slice(i, i + 6);
      i += 6;
      continue;
    }

    // Invalid JSON escape (typical LaTeX): keep the char, escape the slash.
    result += `\\\\${next}`;
    i += 2;
  }

  return result;
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
