import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId } from 'class-validator';

export class ReplaceTopicWiseQuestionDto {
  @ApiProperty({
    description:
      'Question to insert. Must be active, tagged to the draft exam, and the same subject as the slot. When the draft has a topic, the question must have that topic. Difficulty may differ.',
  })
  @IsMongoId()
  questionId: string;
}
