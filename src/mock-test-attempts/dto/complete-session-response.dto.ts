import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AttemptSessionDto } from './attempt-session.dto';
import { ResumeAttemptResponseDto } from './resume-attempt-response.dto';
import { SubmitAttemptResponseDto } from './submit-attempt-response.dto';

export class CompleteSessionResponseDto {
  @ApiProperty({
    description:
      'true when the last session was completed and the whole paper is scored',
    example: false,
  })
  paperCompleted: boolean;

  @ApiProperty({
    description: 'All sessions after this complete (updated statuses)',
    type: [AttemptSessionDto],
  })
  sessions: AttemptSessionDto[];

  @ApiProperty({
    description:
      'Index of the session that is now active (or the last one if finished)',
    example: 1,
  })
  currentSessionIndex: number;

  @ApiPropertyOptional({
    description:
      'Present when paperCompleted is false. Same shape as GET /:attemptId/resume: the **full** paper is still returned. Show only questions whose sessionOrder matches currentSessionIndex (or whose id is in sessions[current].questionIds). Timer fields apply to the newly unlocked session.',
    type: ResumeAttemptResponseDto,
  })
  nextSession?: ResumeAttemptResponseDto;

  @ApiPropertyOptional({
    description:
      'Present when paperCompleted is true. Same shape as POST /:attemptId/submit.',
    type: SubmitAttemptResponseDto,
  })
  results?: SubmitAttemptResponseDto;
}
