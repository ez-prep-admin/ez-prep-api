export const DESCRIPTION_MAX_POINTS = 10;
export const DESCRIPTION_POINT_MIN_LENGTH = 2;
export const DESCRIPTION_POINT_MAX_LENGTH = 500;

export function cleanDescriptionPoints(value: unknown): string[] {
  if (value == null) {
    return [];
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }

  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map(item => item.trim())
    .filter(item => item.length > 0);
}

export function sanitizeDescriptionPoints(value: unknown): string[] {
  return cleanDescriptionPoints(value).slice(0, DESCRIPTION_MAX_POINTS);
}

export function normalizeDescriptionForStorage(
  value: unknown,
): string[] | undefined {
  const points = sanitizeDescriptionPoints(value);
  return points.length > 0 ? points : undefined;
}

export function normalizeDescriptionFromDb(
  value: unknown,
): string[] | undefined {
  return normalizeDescriptionForStorage(value);
}
