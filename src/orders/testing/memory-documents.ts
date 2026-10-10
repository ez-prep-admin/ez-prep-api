export function matchesFilter(
  doc: Record<string, unknown>,
  filter: Record<string, unknown>,
): boolean {
  return Object.entries(filter).every(([key, expected]) => {
    if (key === '$or' && Array.isArray(expected)) {
      return expected.some(
        clause =>
          clause &&
          typeof clause === 'object' &&
          matchesFilter(doc, clause as Record<string, unknown>),
      );
    }
    if (key === '$and' && Array.isArray(expected)) {
      return expected.every(
        clause =>
          clause &&
          typeof clause === 'object' &&
          matchesFilter(doc, clause as Record<string, unknown>),
      );
    }
    return valueMatches(doc[key], expected);
  });
}

export function memoryFindOneAndUpdate<T extends Record<string, unknown>>(
  rows: T[],
  filter: Record<string, unknown>,
  update: { $set?: Record<string, unknown>; $unset?: Record<string, unknown> },
): T | null {
  const row = rows.find(candidate => matchesFilter(candidate, filter));
  if (!row) {
    return null;
  }
  if (update.$set) {
    Object.assign(row, update.$set);
  }
  if (update.$unset) {
    for (const key of Object.keys(update.$unset)) {
      delete row[key];
    }
  }
  return row;
}

export function memoryUpdateOne<T extends Record<string, unknown>>(
  rows: T[],
  filter: Record<string, unknown>,
  update: { $set?: Record<string, unknown>; $unset?: Record<string, unknown> },
): { modifiedCount: number } {
  const row = memoryFindOneAndUpdate(rows, filter, update);
  return { modifiedCount: row ? 1 : 0 };
}

function valueMatches(actual: unknown, expected: unknown): boolean {
  if (
    expected &&
    typeof expected === 'object' &&
    !Array.isArray(expected) &&
    !(expected instanceof Date) &&
    !isObjectId(expected)
  ) {
    const ops = expected as Record<string, unknown>;
    if ('$in' in ops && Array.isArray(ops.$in)) {
      return ops.$in.some(value => same(actual, value));
    }
    if ('$lt' in ops) {
      if (actual == null || ops.$lt == null) {
        return false;
      }
      return (
        new Date(actual as string).getTime() <
        new Date(ops.$lt as string).getTime()
      );
    }
    if ('$exists' in ops) {
      const exists = actual !== undefined && actual !== null;
      return Boolean(ops.$exists) === exists;
    }
    if ('$ne' in ops) {
      return !same(actual, ops.$ne);
    }
    return false;
  }
  if (expected === null) {
    return actual === null || actual === undefined;
  }
  return same(actual, expected);
}

function same(actual: unknown, expected: unknown): boolean {
  return String(actual) === String(expected);
}

function isObjectId(value: object): boolean {
  return (
    typeof (value as { toHexString?: unknown }).toHexString === 'function' ||
    value.constructor?.name === 'ObjectId'
  );
}
