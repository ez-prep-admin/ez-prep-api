import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserAttemptAction } from '../../common/enums/user-attempt-action.enum';
import { SprintQuestionItemDto } from './sprint-draft-response.dto';

export class SprintExamRefDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  description?: string;
}

export class SprintTestListItemDto {
  @ApiProperty()
  id: string;

  @ApiPropertyOptional()
  title?: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty()
  totalQuestions: number;

  @ApiProperty()
  durationInMinutes: number;

  @ApiProperty({ type: SprintExamRefDto, nullable: true })
  exam: SprintExamRefDto | null;

  @ApiProperty()
  marksPerQuestion: number;

  @ApiProperty()
  negativeMarking: number;

  @ApiPropertyOptional()
  passingScore?: number;

  @ApiProperty()
  allowRetake: boolean;

  @ApiProperty()
  shuffleOptions: boolean;

  @ApiProperty()
  showResultsImmediately: boolean;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ enum: UserAttemptAction })
  userAttemptAction: UserAttemptAction;

  @ApiPropertyOptional()
  resumeAttemptId?: string;

  @ApiPropertyOptional({
    description:
      'Admin only. Safe stems in paper order. Students start an attempt to receive questions.',
    type: [SprintQuestionItemDto],
  })
  questions?: SprintQuestionItemDto[];
}
