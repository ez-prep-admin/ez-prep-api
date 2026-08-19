import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsMongoId, IsOptional } from 'class-validator';

export class ReplaceQuestionDto {
  @ApiProperty({
    description:
      'Question ID to insert into this slot. Must be active, have a difficulty, be tagged to the draft exam, and not already appear on the draft. Subject must match the slot unless allowCrossSubject is true. Topic may differ. Marks, position, and slot subject stay with the slot.',
    example: '64f123456789abcdef123456',
  })
  @IsMongoId()
  questionId: string;

  @ApiPropertyOptional({
    description:
      'When true, the incoming question may belong to a different subject. The slot’s subject, marks, and session stay unchanged. The question must still be tagged to this exam.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  allowCrossSubject?: boolean;
}
