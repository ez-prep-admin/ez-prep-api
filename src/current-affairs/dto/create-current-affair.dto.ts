import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ImageMetadataDto } from '../../questions/dto/image-metadata.dto';
import { IsCalendarDate } from '../utils/calendar-date';

export class CreateCurrentAffairDto {
  @ApiProperty({
    description:
      'Headline for the current affairs item. Trimmed on save. Unique per item, not globally.',
    example: 'India launches new satellite for weather monitoring',
    minLength: 2,
    maxLength: 200,
  })
  @IsString()
  @MinLength(2, { message: 'Title must be at least 2 characters long' })
  @MaxLength(200, { message: 'Title cannot exceed 200 characters' })
  @Transform(({ value }) => value?.trim())
  title: string;

  @ApiProperty({
    description:
      'Details about the event. Trimmed on save. Shown in the user-facing daily feed.',
    example:
      'ISRO successfully launched a meteorological satellite from Sriharikota.',
    minLength: 2,
    maxLength: 5000,
  })
  @IsString()
  @MinLength(2, { message: 'Description must be at least 2 characters long' })
  @MaxLength(5000, { message: 'Description cannot exceed 5000 characters' })
  @Transform(({ value }) => value?.trim())
  description: string;

  @ApiProperty({
    description:
      'Calendar date this item belongs to. Must be a real YYYY-MM-DD date (e.g. 2026-02-31 is rejected). Timezone-safe: stored as a string, not a UTC Date. The admin client always sends this; the server does not default to "today".',
    example: '2026-08-14',
    pattern: '^\\d{4}-\\d{2}-\\d{2}$',
  })
  @IsString()
  @IsCalendarDate()
  date: string;

  @ApiPropertyOptional({
    description:
      'Optional mnemonic or memory aid for exam revision. Trimmed on save. Omit if unused.',
    example: 'ISRO + weather = sky report from Sriharikota',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Memory trick cannot exceed 1000 characters' })
  @Transform(({ value }) => value?.trim())
  memoryTrick?: string;

  @ApiPropertyOptional({
    type: ImageMetadataDto,
    description:
      'Optional S3 object metadata from `POST /api/v1/files/upload` (JPEG/PNG). Persist `key`, `bucket`, and `region`. Do not store a long-lived public URL — reads return a short-lived `imageUrl`. Omit to create without an image.',
    example: {
      key: 'admin-images/1723654321-uuid.png',
      bucket: 'ez-prep-assets',
      region: 'ap-south-1',
      contentType: 'image/png',
      size: 48291,
    },
  })
  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @ValidateNested()
  @Type(() => ImageMetadataDto)
  image?: ImageMetadataDto | null;
}
