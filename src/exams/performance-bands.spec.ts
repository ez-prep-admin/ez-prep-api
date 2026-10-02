import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateExamDto } from './dto/create-exam.dto';
import { mapPerformanceBands } from './performance-bands';

const validBands = [
  { key: 'needs_improvement', minPercent: 0 },
  { key: 'good', minPercent: 40 },
  { key: 'very_good', minPercent: 70 },
  { key: 'excellent', minPercent: 85 },
];

function examDto(performanceBands: unknown) {
  return plainToInstance(CreateExamDto, {
    name: 'SBI PO',
    category: '64f123456789abcdef123456',
    examGroup: '64f123456789abcdef123457',
    performanceBands,
  });
}

describe('performanceBands', () => {
  it('maps only known band keys', () => {
    expect(
      mapPerformanceBands([
        { key: 'good', minPercent: 40 },
        { key: 'unknown', minPercent: 10 },
        { key: 'excellent', minPercent: Number.NaN },
      ]),
    ).toEqual([{ key: 'good', minPercent: 40 }]);
    expect(mapPerformanceBands(undefined)).toBeUndefined();
  });

  it('accepts a strictly increasing ladder', async () => {
    const errors = await validate(examDto(validBands));
    expect(errors.find(error => error.property === 'performanceBands')).toBeUndefined();
  });

  it('rejects a ladder that is not strictly increasing', async () => {
    const errors = await validate(
      examDto([
        { key: 'needs_improvement', minPercent: 0 },
        { key: 'good', minPercent: 80 },
        { key: 'very_good', minPercent: 70 },
        { key: 'excellent', minPercent: 85 },
      ]),
    );
    expect(errors.some(error => error.property === 'performanceBands')).toBe(true);
  });

  it('rejects needs_improvement above zero', async () => {
    const errors = await validate(
      examDto([
        { key: 'needs_improvement', minPercent: 10 },
        { key: 'good', minPercent: 40 },
        { key: 'very_good', minPercent: 70 },
        { key: 'excellent', minPercent: 85 },
      ]),
    );
    expect(errors.some(error => error.property === 'performanceBands')).toBe(true);
  });
});
