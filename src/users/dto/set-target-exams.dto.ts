import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsMongoId } from 'class-validator';
import { MAX_TARGET_EXAMS } from '../target-exams.constants';

export class SetTargetExamsDto {
  @ApiProperty({
    description:
      'Ordered exam ids. The first exam is the primary target. Send an empty list to clear targets.',
    type: [String],
    maxItems: MAX_TARGET_EXAMS,
    example: ['64f123456789abcdef123456'],
  })
  @IsArray()
  @ArrayMaxSize(MAX_TARGET_EXAMS)
  @IsMongoId({ each: true })
  examIds: string[];
}

export class TargetExamPromptQueryDto {
  @ApiProperty({
    description: 'Exam the learner just finished a mock for',
    example: '64f123456789abcdef123456',
  })
  @IsMongoId()
  examId: string;
}
