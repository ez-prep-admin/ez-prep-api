import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsMongoId, IsOptional } from 'class-validator';

export class ReplaceSprintQuestionDto {
  @ApiProperty({
    description:
      'Question ID to insert. Must be active, have a difficulty, be tagged to the draft exam, and not already appear on the draft. Subject must match the slot unless allowCrossSubject is true.',
  })
  @IsMongoId()
  questionId: string;

  @ApiPropertyOptional({
    description:
      'When true, the incoming question may belong to a different subject, including one that is not on the exam blueprint. It must still be tagged to this exam. Slot subject, marks, and position stay unchanged.',
  })
  @IsOptional()
  @IsBoolean()
  allowCrossSubject?: boolean;
}
