import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId } from 'class-validator';

export class CreateDraftDto {
  @ApiProperty({
    description:
      'Exam ID from GET /full-mock-tests/exams. The paper is sampled to match this exam’s subject quotas, marks, duration, and session rules. Fails with BLUEPRINT_INVALID or BANK_SHORTAGE if the exam or question bank cannot support a full paper.',
    example: '64f123456789abcdef123456',
  })
  @IsMongoId()
  examId: string;
}
