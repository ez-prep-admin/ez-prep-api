import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { ImageMetadataDto } from './image-metadata.dto';

export class PopulatedRefDto {
  @ApiProperty({ example: '64f123456789abcdef123456' })
  @Expose()
  id: string;

  @ApiProperty({ example: 'Physics' })
  @Expose()
  name: string;
}

export class QuestionTextLanguageResponseDto {
  @ApiPropertyOptional()
  @Expose()
  text?: string | null;

  @ApiPropertyOptional({ type: ImageMetadataDto })
  @Expose()
  image?: ImageMetadataDto | null;
}

export class QuestionTextResponseDto {
  @ApiProperty({ type: QuestionTextLanguageResponseDto })
  @Expose()
  en: QuestionTextLanguageResponseDto;

  @ApiPropertyOptional({ type: QuestionTextLanguageResponseDto })
  @Expose()
  ml?: QuestionTextLanguageResponseDto;
}

export class QuestionOptionResponseDto {
  @ApiProperty()
  @Expose()
  id: string;

  @ApiProperty({ enum: ['text', 'image'] })
  @Expose()
  type: string;

  @ApiPropertyOptional()
  @Expose()
  en?: string | null;

  @ApiPropertyOptional()
  @Expose()
  ml?: string | null;

  @ApiPropertyOptional({ type: ImageMetadataDto })
  @Expose()
  image?: ImageMetadataDto | null;
}

export class ExplanationResponseDto {
  @ApiPropertyOptional()
  @Expose()
  en?: string | null;

  @ApiPropertyOptional()
  @Expose()
  ml?: string | null;

  @ApiPropertyOptional({ type: ImageMetadataDto })
  @Expose()
  image?: ImageMetadataDto | null;
}

export class QuestionResponseDto {
  @ApiProperty({ example: '64f123456789abcdef123456' })
  @Expose()
  id: string;

  @ApiProperty({ type: QuestionTextResponseDto })
  @Expose()
  questionText: QuestionTextResponseDto;

  @ApiPropertyOptional({ enum: ['text', 'image'] })
  @Expose()
  optionType?: string;

  @ApiProperty({ type: [QuestionOptionResponseDto] })
  @Expose()
  options: QuestionOptionResponseDto[];

  @ApiPropertyOptional({ type: ExplanationResponseDto })
  @Expose()
  explanation?: ExplanationResponseDto;

  @ApiProperty()
  @Expose()
  correctAnswer: string;

  @ApiPropertyOptional({ type: PopulatedRefDto })
  @Expose()
  subject?: PopulatedRefDto | string;

  @ApiPropertyOptional({ type: PopulatedRefDto })
  @Expose()
  topic?: PopulatedRefDto | string;

  @ApiPropertyOptional({ type: [PopulatedRefDto] })
  @Expose()
  exams?: PopulatedRefDto[] | string[];

  @ApiPropertyOptional()
  @Expose()
  tag?: string;

  @ApiPropertyOptional({ enum: ['easy', 'medium', 'hard'] })
  @Expose()
  difficultyLevel?: string;

  @ApiProperty()
  @Expose()
  isActive: boolean;

  @ApiProperty()
  @Expose()
  createdAt: Date;

  @ApiProperty()
  @Expose()
  updatedAt: Date;

  constructor(partial: Partial<QuestionResponseDto>) {
    Object.assign(this, partial);
  }
}
