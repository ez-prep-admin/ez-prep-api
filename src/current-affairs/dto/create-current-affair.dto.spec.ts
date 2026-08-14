import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateCurrentAffairDto } from './create-current-affair.dto';
import { UpdateCurrentAffairDto } from './update-current-affair.dto';

describe('CreateCurrentAffairDto', () => {
  it('trims string fields', () => {
    const dto = plainToInstance(CreateCurrentAffairDto, {
      title: '  Satellite launch  ',
      description: '  ISRO launch  ',
      date: '2026-08-14',
      memoryTrick: '  sky report  ',
    });

    expect(dto.title).toBe('Satellite launch');
    expect(dto.description).toBe('ISRO launch');
    expect(dto.memoryTrick).toBe('sky report');
  });

  it('accepts a valid payload', async () => {
    const dto = plainToInstance(CreateCurrentAffairDto, {
      title: 'Satellite launch',
      description: 'ISRO launch',
      date: '2026-08-14',
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects an impossible calendar date', async () => {
    const dto = plainToInstance(CreateCurrentAffairDto, {
      title: 'Satellite launch',
      description: 'ISRO launch',
      date: '2026-02-31',
    });
    const errors = await validate(dto);
    expect(errors.some(error => error.property === 'date')).toBe(true);
  });

  it('rejects a short title', async () => {
    const dto = plainToInstance(CreateCurrentAffairDto, {
      title: 'A',
      description: 'ISRO launch',
      date: '2026-08-14',
    });
    const errors = await validate(dto);
    expect(errors.some(error => error.property === 'title')).toBe(true);
  });

  it('validates nested image metadata when present', async () => {
    const dto = plainToInstance(CreateCurrentAffairDto, {
      title: 'Satellite launch',
      description: 'ISRO launch',
      date: '2026-08-14',
      image: { key: 'k', bucket: 'b', region: 'ap-south-1' },
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('skips nested image validation when image is null', async () => {
    const dto = plainToInstance(CreateCurrentAffairDto, {
      title: 'Satellite launch',
      description: 'ISRO launch',
      date: '2026-08-14',
      image: null,
    });
    expect(await validate(dto)).toHaveLength(0);
  });
});

describe('UpdateCurrentAffairDto', () => {
  it('allows a partial payload', async () => {
    const dto = plainToInstance(UpdateCurrentAffairDto, { isActive: false });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects a negative sortOrder', async () => {
    const dto = plainToInstance(UpdateCurrentAffairDto, { sortOrder: -1 });
    const errors = await validate(dto);
    expect(errors.some(error => error.property === 'sortOrder')).toBe(true);
  });
});
