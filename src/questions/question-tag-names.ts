/** Display names for a question's tags. Ids without a name are skipped. */
export function questionTagNames(
  question:
    | {
        tags?: unknown;
      }
    | null
    | undefined,
): string[] {
  return uniqueTagValues(question?.tags, tagName);
}

/** Tag ids in the same order as {@link questionTagNames}. */
export function questionTagIds(
  question:
    | {
        tags?: unknown;
      }
    | null
    | undefined,
): string[] {
  return uniqueTagValues(question?.tags, questionTagId);
}

function uniqueTagValues(
  tags: unknown,
  read: (value: unknown) => string | null | undefined,
): string[] {
  if (!Array.isArray(tags)) {
    return [];
  }

  const values: string[] = [];
  const seen = new Set<string>();
  for (const tag of tags) {
    const value = read(tag);
    if (!value || seen.has(value)) {
      continue;
    }
    seen.add(value);
    values.push(value);
  }
  return values;
}

/** Keeps a tag id stable when the tag is populated. */
export function questionTagId(value: unknown): string | null {
  if (value == null || value === '') {
    return null;
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value !== 'object') {
    return null;
  }

  const row = value as { id?: unknown; _id?: unknown };
  if (typeof row.id === 'string' && row.id) {
    return row.id;
  }
  if (row._id != null && typeof row._id !== 'object') {
    return String(row._id);
  }
  if (
    row._id &&
    typeof row._id === 'object' &&
    'toString' in row._id &&
    typeof row._id.toString === 'function'
  ) {
    const id = row._id.toString();
    if (id && id !== '[object Object]') {
      return id;
    }
  }
  if ('toString' in value && typeof value.toString === 'function') {
    const text = value.toString();
    if (text && text !== '[object Object]') {
      return text;
    }
  }
  return null;
}

function tagName(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const name = (value as { name?: unknown }).name;
  return typeof name === 'string' && name.trim() ? name.trim() : undefined;
}
