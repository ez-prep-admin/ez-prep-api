import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ImageMetadataDto } from './image-metadata.dto';

export class NamedRefDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;
}

export class QuestionTextLocaleResponseDto {
  @ApiPropertyOptional()
  text?: string | null;

  @ApiPropertyOptional({ type: ImageMetadataDto })
  image?: ImageMetadataDto | null;
}

export class QuestionOptionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  type: string;

  @ApiPropertyOptional()
  en?: string | null;

  @ApiPropertyOptional()
  ml?: string | null;

  @ApiPropertyOptional({ type: ImageMetadataDto })
  image?: ImageMetadataDto | null;
}

export class QuestionExplanationResponseDto {
  @ApiPropertyOptional()
  en?: string | null;

  @ApiPropertyOptional()
  ml?: string | null;

  @ApiPropertyOptional({ type: ImageMetadataDto })
  image?: ImageMetadataDto | null;

  @ApiPropertyOptional({ type: [ImageMetadataDto] })
  images?: ImageMetadataDto[];
}

export class QuestionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  questionText: {
    en?: QuestionTextLocaleResponseDto;
    ml?: QuestionTextLocaleResponseDto;
  };

  @ApiPropertyOptional()
  optionType?: string;

  @ApiProperty({ type: [QuestionOptionResponseDto] })
  options: QuestionOptionResponseDto[];

  @ApiPropertyOptional({ type: QuestionExplanationResponseDto })
  explanation?: QuestionExplanationResponseDto;

  @ApiProperty()
  correctAnswer: string;

  @ApiPropertyOptional()
  subject?: NamedRefDto | string | null;

  @ApiPropertyOptional()
  topic?: NamedRefDto | string | null;

  @ApiPropertyOptional({ type: [NamedRefDto] })
  exams?: Array<NamedRefDto | string>;

  @ApiPropertyOptional()
  tag?: string | null;

  @ApiPropertyOptional()
  difficultyLevel?: string;

  @ApiPropertyOptional()
  source?: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
