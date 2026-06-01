import {
  IsString,
  IsNotEmpty,
  IsOptional,
  ValidateNested,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ImageMetadataDto } from './image-metadata.dto';

export class QuestionTextLanguageDto {
  @ApiPropertyOptional({
    description: 'Question text',
    example: 'What is the powerhouse of the cell?',
  })
  @IsOptional()
  @IsString()
  text?: string | null;

  @ApiPropertyOptional({ description: 'Question image metadata' })
  @IsOptional()
  @ValidateNested()
  @Type(() => ImageMetadataDto)
  image?: ImageMetadataDto | null;
}

export class QuestionTextDto {
  @ApiProperty({ description: 'English question content' })
  @ValidateNested()
  @Type(() => QuestionTextLanguageDto)
  en: QuestionTextLanguageDto;

  @ApiPropertyOptional({ description: 'Malayalam question content' })
  @ValidateNested()
  @Type(() => QuestionTextLanguageDto)
  ml?: QuestionTextLanguageDto;
}

export class QuestionOptionInputDto {
  @ApiProperty({
    description: 'Option unique ID',
    example: '3b23efba-3626-4606-bee3-9130247d1949',
  })
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiPropertyOptional({
    description: 'Option type',
    enum: ['text', 'image'],
    default: 'text',
  })
  @IsOptional()
  @IsEnum(['text', 'image'])
  type?: 'text' | 'image';

  @ApiPropertyOptional({ description: 'Option text in English' })
  @IsOptional()
  @IsString()
  en?: string | null;

  @ApiPropertyOptional({ description: 'Option text in Malayalam' })
  @IsOptional()
  @IsString()
  ml?: string | null;

  @ApiPropertyOptional({ description: 'Option image metadata' })
  @IsOptional()
  @ValidateNested()
  @Type(() => ImageMetadataDto)
  image?: ImageMetadataDto | null;
}

export class ExplanationDto {
  @ApiPropertyOptional({ description: 'Explanation in English' })
  @IsOptional()
  @IsString()
  en?: string | null;

  @ApiPropertyOptional({ description: 'Explanation in Malayalam' })
  @IsOptional()
  @IsString()
  ml?: string | null;

  @ApiPropertyOptional({ description: 'Explanation image metadata' })
  @IsOptional()
  @ValidateNested()
  @Type(() => ImageMetadataDto)
  image?: ImageMetadataDto | null;
}
