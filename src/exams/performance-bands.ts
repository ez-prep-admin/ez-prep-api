import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

export const PERFORMANCE_BAND_KEYS = [
  'needs_improvement',
  'good',
  'very_good',
  'excellent',
] as const;

export type PerformanceBandKey = (typeof PERFORMANCE_BAND_KEYS)[number];

export interface PerformanceBandValue {
  key: PerformanceBandKey;
  minPercent: number;
}

export function mapPerformanceBands(
  source: unknown,
): PerformanceBandValue[] | undefined {
  if (!Array.isArray(source) || source.length === 0) return undefined;

  const bands: PerformanceBandValue[] = [];
  for (const item of source) {
    if (!item || typeof item !== 'object') continue;
    const key = (item as { key?: unknown }).key;
    const minPercent = (item as { minPercent?: unknown }).minPercent;
    if (
      typeof key === 'string' &&
      (PERFORMANCE_BAND_KEYS as readonly string[]).includes(key) &&
      typeof minPercent === 'number' &&
      Number.isFinite(minPercent)
    ) {
      bands.push({ key: key as PerformanceBandKey, minPercent });
    }
  }

  return bands.length > 0 ? bands : undefined;
}

@ValidatorConstraint({ name: 'performanceBands', async: false })
export class PerformanceBandsConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (!Array.isArray(value)) return false;

    const byKey = new Map<string, number>();
    for (const band of value) {
      if (!band || typeof band !== 'object') return false;
      const key = (band as { key?: unknown }).key;
      const minPercent = (band as { minPercent?: unknown }).minPercent;
      if (typeof key !== 'string' || byKey.has(key)) return false;
      if (typeof minPercent !== 'number' || !Number.isFinite(minPercent)) {
        return false;
      }
      byKey.set(key, minPercent);
    }

    if (byKey.size !== PERFORMANCE_BAND_KEYS.length) return false;
    for (const key of PERFORMANCE_BAND_KEYS) {
      if (!byKey.has(key)) return false;
    }

    const [needs, good, veryGood, excellent] = PERFORMANCE_BAND_KEYS.map(
      key => byKey.get(key) as number,
    );
    return needs === 0 && needs < good && good < veryGood && veryGood < excellent;
  }

  defaultMessage(): string {
    return 'performanceBands must include all four keys, with needs_improvement at 0 and strictly increasing cutoffs for good, very_good, and excellent';
  }
}
