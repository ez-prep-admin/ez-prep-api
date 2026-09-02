import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateCurrentAffairDto } from './create-current-affair.dto';
import { UpdateCurrentAffairDto } from './update-current-affair.dto';

describe('CreateCurrentAffairDto', () => {
  it('trims string fields and description bullets', () => {
    const dto = plainToInstance(CreateCurrentAffairDto, {
      title: '  Satellite launch  ',
      description: ['  ISRO launch  ', '  second point  '],
      date: '2026-08-14',
      memoryTrick: '  sky report  ',
    });

    expect(dto.title).toBe('Satellite launch');
    expect(dto.description).toEqual(['ISRO launch', 'second point']);
    expect(dto.memoryTrick).toBe('sky report');
  });

  it('accepts a valid payload with description bullets', async () => {
    const dto = plainToInstance(CreateCurrentAffairDto, {
      title: 'Satellite launch',
      description: ['ISRO launch', 'Second point'],
      date: '2026-08-14',
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('accepts a payload without a description', async () => {
    const dto = plainToInstance(CreateCurrentAffairDto, {
      title: 'Satellite launch',
      date: '2026-08-14',
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('strips empty description bullets', async () => {
    const dto = plainToInstance(CreateCurrentAffairDto, {
      title: 'Satellite launch',
      description: ['   ', 'Valid point'],
      date: '2026-08-14',
    });
    expect(dto.description).toEqual(['Valid point']);
    expect(await validate(dto)).toHaveLength(0);
  });

  it('drops description when all bullets are empty', async () => {
    const dto = plainToInstance(CreateCurrentAffairDto, {
      title: 'Satellite launch',
      description: ['   ', ''],
      date: '2026-08-14',
    });
    expect(dto.description).toBeUndefined();
    expect(await validate(dto)).toHaveLength(0);
  });

  it('accepts legacy string description input', async () => {
    const dto = plainToInstance(CreateCurrentAffairDto, {
      title: 'Satellite launch',
      description: '  ISRO launch  ',
      date: '2026-08-14',
    });
    expect(dto.description).toEqual(['ISRO launch']);
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects a short description bullet', async () => {
    const dto = plainToInstance(CreateCurrentAffairDto, {
      title: 'Satellite launch',
      description: ['A'],
      date: '2026-08-14',
    });
    const errors = await validate(dto);
    expect(errors.some(error => error.property === 'description')).toBe(true);
  });

  it('rejects more than 10 description bullets', async () => {
    const dto = plainToInstance(CreateCurrentAffairDto, {
      title: 'Satellite launch',
      description: Array.from({ length: 11 }, (_, index) => `Point ${index}`),
      date: '2026-08-14',
    });
    const errors = await validate(dto);
    expect(errors.some(error => error.property === 'description')).toBe(true);
  });

  it('rejects an impossible calendar date', async () => {
    const dto = plainToInstance(CreateCurrentAffairDto, {
      title: 'Satellite launch',
      description: ['ISRO launch'],
      date: '2026-02-31',
    });
    const errors = await validate(dto);
    expect(errors.some(error => error.property === 'date')).toBe(true);
  });

  it('rejects a short title', async () => {
    const dto = plainToInstance(CreateCurrentAffairDto, {
      title: 'A',
      description: ['ISRO launch'],
      date: '2026-08-14',
    });
    const errors = await validate(dto);
    expect(errors.some(error => error.property === 'title')).toBe(true);
  });

  it('validates nested image metadata when present', async () => {
    const dto = plainToInstance(CreateCurrentAffairDto, {
      title: 'Satellite launch',
      description: ['ISRO launch'],
      date: '2026-08-14',
      image: { key: 'k', bucket: 'b', region: 'ap-south-1' },
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('skips nested image validation when image is null', async () => {
    const dto = plainToInstance(CreateCurrentAffairDto, {
      title: 'Satellite launch',
      description: ['ISRO launch'],
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

  it('preserves an empty description array for clearing', () => {
    const dto = plainToInstance(UpdateCurrentAffairDto, { description: [] });
    expect(dto.description).toEqual([]);
  });

  it('rejects a negative sortOrder', async () => {
    const dto = plainToInstance(UpdateCurrentAffairDto, { sortOrder: -1 });
    const errors = await validate(dto);
    expect(errors.some(error => error.property === 'sortOrder')).toBe(true);
  });
});
