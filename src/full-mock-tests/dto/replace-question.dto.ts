import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId } from 'class-validator';

export class ReplaceQuestionDto {
  @ApiProperty({
    description:
      'Question ID to insert into this slot. Must be active, have a difficulty, belong to the same subject as the slot, and not already appear on the draft. Topic may differ. Marks and position stay with the slot.',
    example: '64f123456789abcdef123456',
  })
  @IsMongoId()
  questionId: string;
}
