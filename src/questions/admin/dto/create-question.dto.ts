import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
  IsEnum,
  IsMongoId,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  QuestionTextDto,
  QuestionOptionInputDto,
  ExplanationDto,
} from './question-input.dto';

export class CreateQuestionDto {
  @ApiProperty({ description: 'Question text with bilingual support' })
  @ValidateNested()
  @Type(() => QuestionTextDto)
  questionText: QuestionTextDto;

  @ApiPropertyOptional({
    description: 'Option type for this question',
    enum: ['text', 'image'],
    default: 'text',
  })
  @IsOptional()
  @IsEnum(['text', 'image'])
  optionType?: 'text' | 'image';

  @ApiProperty({
    description: 'Exactly 4 answer options',
    type: [QuestionOptionInputDto],
  })
  @IsArray()
  @ArrayMinSize(4, { message: 'Exactly 4 options are required' })
  @ArrayMaxSize(4, { message: 'Exactly 4 options are required' })
  @ValidateNested({ each: true })
  @Type(() => QuestionOptionInputDto)
  options: QuestionOptionInputDto[];

  @ApiPropertyOptional({ description: 'Explanation with bilingual support' })
  @IsOptional()
  @ValidateNested()
  @Type(() => ExplanationDto)
  explanation?: ExplanationDto;

  @ApiProperty({
    description: 'ID of the correct option',
    example: '3b23efba-3626-4606-bee3-9130247d1949',
  })
  @IsString()
  @IsNotEmpty({ message: 'Correct answer is required' })
  correctAnswer: string;

  @ApiPropertyOptional({ description: 'Subject ID' })
  @IsOptional()
  @IsMongoId()
  subject?: string;

  @ApiPropertyOptional({ description: 'Topic ID' })
  @IsOptional()
  @IsMongoId()
  topic?: string;

  @ApiPropertyOptional({
    description: 'Exam IDs',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  exams?: string[];

  @ApiPropertyOptional({ description: 'Tag ID' })
  @IsOptional()
  @IsMongoId()
  tag?: string;

  @ApiPropertyOptional({
    description: 'Difficulty level',
    enum: ['easy', 'medium', 'hard'],
  })
  @IsOptional()
  @IsEnum(['easy', 'medium', 'hard'])
  difficultyLevel?: 'easy' | 'medium' | 'hard';
}
