import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ImageMetadataDto } from './image-metadata.dto';

export class QuestionTextLocaleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  text?: string | null;

  @ApiPropertyOptional({ type: ImageMetadataDto })
  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @ValidateNested()
  @Type(() => ImageMetadataDto)
  image?: ImageMetadataDto | null;
}

export class QuestionTextDto {
  @ApiProperty({ type: QuestionTextLocaleDto })
  @ValidateNested()
  @Type(() => QuestionTextLocaleDto)
  en: QuestionTextLocaleDto;

  @ApiPropertyOptional({ type: QuestionTextLocaleDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => QuestionTextLocaleDto)
  ml?: QuestionTextLocaleDto;
}

export class QuestionOptionDto {
  @ApiProperty()
  @IsString()
  id: string;

  @ApiProperty({ enum: ['text', 'image'] })
  @IsEnum(['text', 'image'])
  type: 'text' | 'image';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  en?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ml?: string | null;

  @ApiPropertyOptional({ type: ImageMetadataDto })
  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @ValidateNested()
  @Type(() => ImageMetadataDto)
  image?: ImageMetadataDto | null;
}

export class QuestionExplanationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  en?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ml?: string | null;

  @ApiPropertyOptional({ type: ImageMetadataDto })
  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @ValidateNested()
  @Type(() => ImageMetadataDto)
  image?: ImageMetadataDto | null;

  @ApiPropertyOptional({ type: [ImageMetadataDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImageMetadataDto)
  images?: ImageMetadataDto[];
}

export class CreateQuestionDto {
  @ApiProperty({ type: QuestionTextDto })
  @ValidateNested()
  @Type(() => QuestionTextDto)
  questionText: QuestionTextDto;

  @ApiPropertyOptional({ enum: ['text', 'image'] })
  @IsOptional()
  @IsEnum(['text', 'image'])
  optionType?: 'text' | 'image';

  @ApiProperty({ type: [QuestionOptionDto] })
  @IsArray()
  @ArrayMinSize(4)
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => QuestionOptionDto)
  options: QuestionOptionDto[];

  @ApiPropertyOptional({ type: QuestionExplanationDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => QuestionExplanationDto)
  explanation?: QuestionExplanationDto;

  @ApiProperty()
  @IsString()
  correctAnswer: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, value) => value != null && value !== '')
  @IsMongoId()
  subject?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, value) => value != null && value !== '')
  @IsMongoId()
  topic?: string | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  exams?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, value) => value != null && value !== '')
  @IsMongoId()
  tag?: string | null;

  @ApiPropertyOptional({ enum: ['easy', 'medium', 'hard'] })
  @IsOptional()
  @IsEnum(['easy', 'medium', 'hard'])
  difficultyLevel?: 'easy' | 'medium' | 'hard';
}
