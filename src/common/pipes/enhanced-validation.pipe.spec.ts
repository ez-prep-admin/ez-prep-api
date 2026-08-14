import { BadRequestException } from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import { EnhancedValidationPipe } from './enhanced-validation.pipe';

class SampleDto {
  @IsString()
  @MinLength(3)
  name: string;
}

describe('EnhancedValidationPipe', () => {
  let pipe: EnhancedValidationPipe;

  beforeEach(() => {
    pipe = new EnhancedValidationPipe();
  });

  it('should return value when metatype is missing', async () => {
    await expect(
      pipe.transform('raw', { type: 'custom', metatype: undefined } as any),
    ).resolves.toBe('raw');
  });

  it('should skip primitive metatypes', async () => {
    await expect(
      pipe.transform(1, { type: 'custom', metatype: Number }),
    ).resolves.toBe(1);
    await expect(
      pipe.transform('x', { type: 'custom', metatype: String }),
    ).resolves.toBe('x');
    await expect(
      pipe.transform(true, { type: 'custom', metatype: Boolean }),
    ).resolves.toBe(true);
    await expect(
      pipe.transform([], { type: 'custom', metatype: Array }),
    ).resolves.toEqual([]);
    await expect(
      pipe.transform({}, { type: 'custom', metatype: Object }),
    ).resolves.toEqual({});
  });

  it('should transform valid objects', async () => {
    const result = await pipe.transform(
      { name: 'Ada' },
      { type: 'body', metatype: SampleDto },
    );

    expect(result).toBeInstanceOf(SampleDto);
    expect((result as SampleDto).name).toBe('Ada');
  });

  it('should throw BadRequestException with formatted errors', async () => {
    await expect(
      pipe.transform({ name: 'ab' }, { type: 'body', metatype: SampleDto }),
    ).rejects.toBeInstanceOf(BadRequestException);

    try {
      await pipe.transform({ name: 1 }, { type: 'body', metatype: SampleDto });
    } catch (error) {
      const response = (error as BadRequestException).getResponse() as any;
      expect(response.error).toBe('ValidationError');
      expect(response.errors[0].field).toBe('name');
      expect(Array.isArray(response.errors[0].constraints)).toBe(true);
    }
  });
});
